import { NextResponse } from 'next/server';

export function jsonError(message, status = 400, details) {
  return NextResponse.json({ error: message, ...(details ? { details } : {}) }, { status });
}
