import type { ObjectSchema } from '@banez/object-utility/types';
import type { ObjectId } from '@fastify/mongodb';

export interface MongoDBEntry {
  _id: string;
  createdAt: number;
  updatedAt: number;
}

export interface MongoDBEntryOID {
  _id: ObjectId;
  createdAt: number;
  updatedAt: number;
}

export const MongoDBEntrySchema: ObjectSchema = {
  _id: {
    __type: 'string',
    __required: true,
  },
  createdAt: {
    __type: 'number',
    __required: true,
  },
  updatedAt: {
    __type: 'number',
    __required: true,
  },
};
