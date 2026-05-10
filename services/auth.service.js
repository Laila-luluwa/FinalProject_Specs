const prisma = require("../lib/prisma");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET || "supersecret";

import { generateAccessToken, generateRefreshToken } from "../lib/jwt.js";

const accessToken = generateAccessToken(user);
const refreshToken = generateRefreshToken(user);

return {
  accessToken,
  refreshToken,
};

async function register(name, email, password) {
  const hashed = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: hashed,
    },
  });

  return user;
}

async function login(email, password) {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) throw new Error("User not found");

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new Error("Invalid password");

  const token = jwt.sign(
    { userId: user.id },
    SECRET,
    { expiresIn: "1h" }
  );

  return { token };
}


module.exports = { register, login };