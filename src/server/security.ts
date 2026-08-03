import argon2 from "argon2";
import crypto from "node:crypto";

export async function hashPassword(password: string) { return argon2.hash(password, { type: argon2.argon2id }); }
export async function verifyPassword(hash: string, password: string) { return argon2.verify(hash, password); }
export function randomToken() { return crypto.randomBytes(32).toString("base64url"); }
export function hashToken(token: string) { return crypto.createHash("sha256").update(token).digest("hex"); }
export function requestId() { return crypto.randomUUID(); }
export function passwordIsStrong(password: string) { return password.length >= 10 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password); }
