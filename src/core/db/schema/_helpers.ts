import { sql } from "drizzle-orm";
import { timestamp, uuid } from "drizzle-orm/pg-core";
import { uuidv7 } from "@/lib/uuid";

/** PK uuid v7 generado en la app (con respaldo gen_random_uuid() para SQL directo). */
export const id = () =>
  uuid()
    .primaryKey()
    .$defaultFn(() => uuidv7())
    .default(sql`gen_random_uuid()`);

export const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();
export const updatedAt = () =>
  timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

/** Borrado lógico. Los registros ♻ (retención 20 años) nunca se eliminan físicamente. */
export const deletedAt = () => timestamp({ withTimezone: true });
