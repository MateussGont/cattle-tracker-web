import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import WebSocket from "ws";
import { buildApp } from "../src/app.js";
import { closeDb, db } from "../src/db/client.js";
import {
  alerts,
  animals,
  deviceAssignments,
  devices,
  properties,
  userProperties,
  users,
} from "../src/db/schema.js";
import { broadcast } from "../src/websocket/realtime.js";

describe("property-scoped authorization", () => {
  let app: FastifyInstance;
  let viewerToken: string;
  let managerToken: string;
  let noAccessToken: string;
  let adminToken: string;
  let websocketUrl: string;
  const ids = {
    users: [] as string[],
    properties: [] as string[],
    animals: [] as string[],
    devices: [] as string[],
    alerts: [] as string[],
  };
  let propertyA: string;
  let propertyB: string;
  let animalA: string;
  let deviceA: string;
  let deviceB: string;
  let alertB: string;

  beforeAll(async () => {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const [admin] = await db.select({ passwordHash: users.passwordHash }).from(users).limit(1);
    if (!admin) throw new Error("Run db:seed before integration tests.");

    const createdProperties = await db
      .insert(properties)
      .values([{ name: `Auth A ${suffix}` }, { name: `Auth B ${suffix}` }])
      .returning({ id: properties.id });
    [propertyA, propertyB] = createdProperties.map((row) => row.id);
    ids.properties.push(propertyA, propertyB);

    const createdUsers = await db
      .insert(users)
      .values([
        { name: "Viewer", email: `viewer-${suffix}@test.local`, passwordHash: admin.passwordHash, role: "viewer" },
        { name: "Manager", email: `manager-${suffix}@test.local`, passwordHash: admin.passwordHash, role: "manager" },
        { name: "No access", email: `none-${suffix}@test.local`, passwordHash: admin.passwordHash, role: "viewer" },
      ])
      .returning({ id: users.id, role: users.role, email: users.email });
    ids.users.push(...createdUsers.map((row) => row.id));
    const [viewer, manager, noAccess] = createdUsers;
    if (!viewer || !manager || !noAccess) throw new Error("Failed to create integration users.");

    await db.insert(userProperties).values([
      { userId: viewer.id, propertyId: propertyA, roleOnProperty: "viewer" },
      { userId: manager.id, propertyId: propertyA, roleOnProperty: "manager" },
    ]);

    const createdAnimals = await db
      .insert(animals)
      .values([
        { tagCode: `AUTH-A-${suffix}`, propertyId: propertyA },
        { tagCode: `AUTH-B-${suffix}`, propertyId: propertyB },
      ])
      .returning({ id: animals.id });
    [animalA] = createdAnimals.map((row) => row.id);
    ids.animals.push(...createdAnimals.map((row) => row.id));

    const radioBase = Math.floor(Math.random() * 30000) + 20000;
    const createdDevices = await db
      .insert(devices)
      .values([
        { deviceIdentifier: `AUTH-DEV-A-${suffix}`, radioDeviceId: radioBase },
        { deviceIdentifier: `AUTH-DEV-B-${suffix}`, radioDeviceId: radioBase + 1 },
      ])
      .returning({ id: devices.id });
    [deviceA, deviceB] = createdDevices.map((row) => row.id);
    ids.devices.push(deviceA, deviceB);
    await db.insert(deviceAssignments).values([
      { animalId: createdAnimals[0]!.id, deviceId: deviceA },
      { animalId: createdAnimals[1]!.id, deviceId: deviceB },
    ]);

    const [createdAlert] = await db
      .insert(alerts)
      .values({ type: "other", severity: "warning", propertyId: propertyB, message: "private alert" })
      .returning({ id: alerts.id });
    if (!createdAlert) throw new Error("Failed to create integration alert.");
    alertB = createdAlert.id;
    ids.alerts.push(alertB);

    app = await buildApp();
    const address = await app.listen({ host: "127.0.0.1", port: 0 });
    websocketUrl = address.replace(/^http/, "ws");
    viewerToken = app.jwt.sign({ sub: viewer.id, email: viewer.email, role: viewer.role });
    managerToken = app.jwt.sign({ sub: manager.id, email: manager.email, role: manager.role });
    noAccessToken = app.jwt.sign({ sub: noAccess.id, email: noAccess.email, role: noAccess.role });
    adminToken = app.jwt.sign({ sub: viewer.id, email: viewer.email, role: "admin" });
  });

  afterAll(async () => {
    await db.delete(deviceAssignments).where(inArray(deviceAssignments.deviceId, ids.devices));
    await db.delete(alerts).where(inArray(alerts.id, ids.alerts));
    await db.delete(animals).where(inArray(animals.id, ids.animals));
    await db.delete(devices).where(inArray(devices.id, ids.devices));
    await db.delete(userProperties).where(inArray(userProperties.userId, ids.users));
    await db.delete(users).where(inArray(users.id, ids.users));
    await db.delete(properties).where(inArray(properties.id, ids.properties));
    await app?.close();
    await closeDb();
  });

  const auth = (token: string) => ({ authorization: `Bearer ${token}` });

  it("returns only the viewer property and its resources", async () => {
    const propertyResponse = await app.inject({ method: "GET", url: "/api/properties", headers: auth(viewerToken) });
    expect(propertyResponse.statusCode).toBe(200);
    expect(propertyResponse.json().map((row: { id: string }) => row.id)).toEqual([propertyA]);

    for (const url of ["/api/animals", "/api/map/animals", "/api/dashboard/summary", "/api/alerts"]) {
      const response = await app.inject({ method: "GET", url, headers: auth(viewerToken) });
      expect(response.statusCode, url).toBe(200);
    }

    const deviceResponse = await app.inject({ method: "GET", url: "/api/devices", headers: auth(viewerToken) });
    expect(deviceResponse.statusCode).toBe(200);
    expect(deviceResponse.json().map((row: { id: string }) => row.id)).toEqual([deviceA]);
  });

  it("does not broaden scope through query parameters or resource ids", async () => {
    const animalsResponse = await app.inject({
      method: "GET",
      url: `/api/animals?propertyId=${propertyB}`,
      headers: auth(viewerToken),
    });
    expect(animalsResponse.statusCode).toBe(403);

    const deviceResponse = await app.inject({ method: "GET", url: `/api/devices/${deviceB}`, headers: auth(viewerToken) });
    expect(deviceResponse.statusCode).toBe(403);

    const alertResponse = await app.inject({
      method: "PUT",
      url: `/api/alerts/${alertB}`,
      headers: auth(viewerToken),
      payload: { status: "resolved" },
    });
    expect(alertResponse.statusCode).toBe(403);
  });

  it("blocks viewers from writing and managers from moving resources out of scope", async () => {
    const viewerWrite = await app.inject({
      method: "POST",
      url: "/api/animals",
      headers: auth(viewerToken),
      payload: { tagCode: "VIEWER-WRITE", propertyId: propertyA },
    });
    expect(viewerWrite.statusCode).toBe(403);

    const managerMove = await app.inject({
      method: "PUT",
      url: `/api/animals/${animalA}`,
      headers: auth(managerToken),
      payload: { propertyId: propertyB },
    });
    expect(managerMove.statusCode).toBe(403);

    const managerStealDevice = await app.inject({
      method: "POST",
      url: `/api/animals/${animalA}/device`,
      headers: auth(managerToken),
      payload: { deviceId: deviceB },
    });
    expect(managerStealDevice.statusCode).toBe(403);
  });

  it("returns empty collections for users without any property", async () => {
    for (const url of ["/api/properties", "/api/animals", "/api/devices", "/api/map/animals", "/api/alerts"]) {
      const response = await app.inject({ method: "GET", url, headers: auth(noAccessToken) });
      expect(response.statusCode, url).toBe(200);
      expect(response.json(), url).toEqual([]);
    }
  });

  it("scopes realtime events by property while admins receive all events", async () => {
    const openSocket = (token: string) => new Promise<WebSocket>((resolve, reject) => {
      const socket = new WebSocket(`${websocketUrl}/ws?token=${encodeURIComponent(token)}`);
      socket.once("open", () => resolve(socket));
      socket.once("error", reject);
    });
    const waitForMessage = (socket: WebSocket, timeoutMs = 300) => new Promise<string | null>((resolve) => {
      const timer = setTimeout(() => resolve(null), timeoutMs);
      socket.once("message", (data) => {
        clearTimeout(timer);
        resolve(data.toString());
      });
    });

    const [viewerSocket, noAccessSocket, adminSocket] = await Promise.all([
      openSocket(viewerToken),
      openSocket(noAccessToken),
      openSocket(adminToken),
    ]);

    const viewerMessage = waitForMessage(viewerSocket);
    const noAccessMessage = waitForMessage(noAccessSocket);
    const adminMessage = waitForMessage(adminSocket);
    broadcast({ type: "location_update", propertyId: propertyA, payload: { animalId: animalA } });

    expect(JSON.parse((await viewerMessage) as string).payload.animalId).toBe(animalA);
    expect(await noAccessMessage).toBeNull();
    expect(JSON.parse((await adminMessage) as string).payload.animalId).toBe(animalA);

    const crossPropertyMessage = waitForMessage(viewerSocket);
    broadcast({ type: "alert_created", propertyId: propertyB, payload: { id: alertB } });
    expect(await crossPropertyMessage).toBeNull();

    viewerSocket.close();
    noAccessSocket.close();
    adminSocket.close();
  });
});
