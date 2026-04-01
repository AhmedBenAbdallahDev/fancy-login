-- Migration: Change agent.userId from uuid to text for supporting both PostgreSQL UUIDs and GitHub numeric IDs
-- Also remove the foreign key constraint since GitHub users may not have a user table entry

-- Step 1: Drop the foreign key constraint if it exists
ALTER TABLE "agent" DROP CONSTRAINT IF EXISTS "agent_user_id_user_id_fk";

-- Step 2: Change the userId column type from uuid to text
ALTER TABLE "agent" ALTER COLUMN "user_id" TYPE text USING "user_id"::text;
