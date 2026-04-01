"use server";

import { pgUserRepository } from "lib/db/pg/repositories/user-repository.pg";

export async function existsByEmailAction(email: string) {
  const exists = await pgUserRepository.existsByEmail(email);
  return exists;
}
