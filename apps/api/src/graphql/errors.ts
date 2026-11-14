import { GraphQLError } from "graphql";

type Code = "BAD_USER_INPUT" | "NOT_FOUND" | "FORBIDDEN" | "UNAUTHENTICATED" | "CONFLICT";

const STATUS: Record<Code, number> = {
  BAD_USER_INPUT: 400,
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  UNAUTHENTICATED: 401,
  CONFLICT: 409,
};

export function apiError(code: Code, message: string): GraphQLError {
  return new GraphQLError(message, { extensions: { code, http: { status: STATUS[code] } } });
}
