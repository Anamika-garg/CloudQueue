'use strict';

const { z } = require('zod');
const { isValidDateKey } = require('../lib/dateKey');

const objectId = z
  .string()
  .regex(/^[a-f0-9]{24}$/i, 'Must be a 24 character identifier');

const dateKey = z
  .string()
  .refine(isValidDateKey, 'Use the YYYY-MM-DD format');

const color = z.enum(['indigo', 'emerald', 'amber', 'rose', 'sky', 'violet', 'teal', 'orange']);

const createService = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2,5}$/, 'Code must be 2-5 letters'),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional().default(''),
  location: z.string().trim().max(160).optional().default(''),
  averageServiceMinutes: z.coerce.number().int().min(1).max(180).optional().default(5),
  color: color.optional().default('indigo'),
  isActive: z.boolean().optional().default(true),
});

const updateService = createService.partial().refine(
  (value) => Object.keys(value).length > 0,
  'Provide at least one field to update'
);

const issueToken = z.object({ serviceId: objectId });

const queueQuery = z.object({ serviceId: objectId });

const callNext = z.object({
  serviceId: objectId,
  dateKey: dateKey.optional(),
});

const markServed = z.object({
  action: z.enum(['served', 'no_show']),
  notes: z.string().trim().max(300).optional(),
});

const statsQuery = z
  .object({
    serviceId: objectId.optional(),
    date: dateKey.optional(),
  })
  .default({});

const historyQuery = z
  .object({
    serviceId: objectId.optional(),
    date: dateKey.optional(),
    status: z.enum(['waiting', 'serving', 'served', 'cancelled', 'no_show']).optional(),
    page: z.coerce.number().int().min(1).max(1000).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(25),
  })
  .default({});

const auditQuery = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(25),
    action: z.string().max(64).optional(),
  })
  .default({});

const demoLogin = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().max(128).optional(),
  displayName: z.string().trim().max(120).optional(),
});

const updateRole = z.object({ role: z.enum(['user', 'admin', 'super_admin']) });

module.exports = {
  objectId,
  dateKey,
  color,
  createService,
  updateService,
  issueToken,
  queueQuery,
  callNext,
  markServed,
  statsQuery,
  historyQuery,
  auditQuery,
  demoLogin,
  updateRole,
};
