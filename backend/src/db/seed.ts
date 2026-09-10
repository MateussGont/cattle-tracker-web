import argon2 from "argon2";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, closeDb } from "./client.js";
import {
  animals,
  devices,
  deviceAssignments,
  properties,
  settings,
  userProperties,
  users,
} from "./schema.js";

const DEFAULT_SETTINGS: Array<{ key: string; value: unknown; description: string }> = [
  {
    key: "device_attention_minutes",
    value: 20,
    description: "Minutos sem comunicação para o dispositivo mudar de ONLINE para ATENÇÃO.",
  },
  {
    key: "device_offline_minutes",
    value: 60,
    description: "Minutos sem comunicação para o dispositivo mudar para OFFLINE.",
  },
  {
    key: "device_low_battery_percent",
    value: 20,
    description: "Percentual de bateria abaixo do qual um alerta de bateria baixa é disparado.",
  },
];

async function main(): Promise<void> {
  const passwordHash = await argon2.hash("ChangeMe123!");

  await db
    .insert(users)
    .values({
      name: "Administrador",
      email: "admin@cattletracker.local",
      passwordHash,
      role: "admin",
      status: "active",
    })
    .onConflictDoNothing({ target: users.email });

  const [admin] = await db.select().from(users).where(eq(users.email, "admin@cattletracker.local")).limit(1);

  if (!admin) {
    throw new Error("Failed to seed admin user");
  }

  let [property] = await db.select().from(properties).where(eq(properties.name, "Fazenda Modelo")).limit(1);
  if (!property) {
    [property] = await db
      .insert(properties)
      .values({
        name: "Fazenda Modelo",
        location: sql`ST_SetSRID(ST_MakePoint(-44.012345, -19.923456), 4326)::geography`,
        boundary: sql`ST_SetSRID(ST_GeomFromText('POLYGON((-44.02 -19.93, -44.00 -19.93, -44.00 -19.91, -44.02 -19.91, -44.02 -19.93))'), 4326)`,
        areaHectares: 400,
      })
      .returning();
  }

  if (!property) {
    throw new Error("Failed to seed property");
  }

  await db
    .insert(userProperties)
    .values({ userId: admin.id, propertyId: property.id, roleOnProperty: "admin" })
    .onConflictDoNothing();

  const seedAnimals = [
    { tagCode: "BOV-0001", name: "Boi 102", radioDeviceId: 1, deviceIdentifier: "BRINCO-0001" },
    { tagCode: "BOV-0002", name: "Boi 105", radioDeviceId: 2, deviceIdentifier: "BRINCO-0002" },
    { tagCode: "BOV-0003", name: "Boi 117", radioDeviceId: 3, deviceIdentifier: "BRINCO-0003" },
  ];

  for (const seedAnimal of seedAnimals) {
    await db
      .insert(animals)
      .values({
        tagCode: seedAnimal.tagCode,
        name: seedAnimal.name,
        sex: "female",
        status: "active",
        propertyId: property.id,
      })
      .onConflictDoNothing({ target: animals.tagCode });

    const [animal] = await db.select().from(animals).where(eq(animals.tagCode, seedAnimal.tagCode)).limit(1);

    if (!animal) {
      throw new Error(`Failed to seed animal ${seedAnimal.tagCode}`);
    }

    await db
      .insert(devices)
      .values({
        deviceIdentifier: seedAnimal.deviceIdentifier,
        radioDeviceId: seedAnimal.radioDeviceId,
        hardwareModel: "XIAO ESP32-S3 + Wio-SX1262",
        status: "active",
      })
      .onConflictDoNothing();

    const [device] = await db
      .select()
      .from(devices)
      .where(eq(devices.deviceIdentifier, seedAnimal.deviceIdentifier))
      .limit(1);

    if (!device) {
      throw new Error(`Failed to seed device ${seedAnimal.deviceIdentifier}`);
    }

    const [assignment] = await db
      .select({ deviceId: deviceAssignments.deviceId })
      .from(deviceAssignments)
      .where(and(
        eq(deviceAssignments.deviceId, device.id),
        eq(deviceAssignments.animalId, animal.id),
        isNull(deviceAssignments.unassignedAt),
      ))
      .limit(1);
    if (!assignment) {
      await db.insert(deviceAssignments).values({ deviceId: device.id, animalId: animal.id });
    }
  }

  await db
    .insert(settings)
    .values(DEFAULT_SETTINGS)
    .onConflictDoNothing({ target: settings.key });

  console.log("Seed completed.");
  console.log(`Admin login: admin@cattletracker.local / ChangeMe123! (troque após o primeiro login)`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(() => {
    void closeDb();
  });
