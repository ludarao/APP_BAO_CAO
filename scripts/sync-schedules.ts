import "dotenv/config";
import { db } from "../src/lib/db";
import { syncSchedules } from "../src/lib/schedules";
syncSchedules()
  .then((result) => console.log("Lịch báo cáo:", result))
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => db().$disconnect());
