import { ROLES } from "../constants.js";

export function withRole(req, res, next) {
  const role = (req.header("x-role") || "PM").toUpperCase();
  req.role = ROLES.includes(role) ? role : "PM";
  next();
}
