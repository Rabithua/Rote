import prisma from '../prisma';
import { DatabaseError } from './common';

// API密钥相关方法
export async function generateOpenKey(userid: string): Promise<any> {
  try {
    const openKey = await prisma.userOpenKey.create({
      data: {
        permissions: ['SENDROTE'],
        userid,
      },
    });
    return openKey;
  } catch (error) {
    throw new DatabaseError('Failed to generate open key', error);
  }
}

export async function getMyOpenKey(userid: string): Promise<any> {
  try {
    const openKeys = await prisma.userOpenKey.findMany({
      where: { userid },
    });
    return openKeys;
  } catch (error) {
    throw new DatabaseError('Failed to get user open keys', error);
  }
}

export async function deleteMyOneOpenKey(userid: string, id: string): Promise<any> {
  try {
    const openKey = await prisma.userOpenKey.findUnique({
      where: { id },
    });

    if (!openKey) {
      throw new DatabaseError('Open key not found');
    }

    if (openKey.userid !== userid) {
      throw new DatabaseError('Unauthorized to delete this open key');
    }

    const result = await prisma.userOpenKey.delete({
      where: { id },
    });
    return result;
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }
    throw new DatabaseError(`Failed to delete open key: ${id}`, error);
  }
}

export async function editMyOneOpenKey(
  userid: string,
  id: string,
  permissions: string[]
): Promise<any> {
  try {
    const openKey = await prisma.userOpenKey.findUnique({
      where: { id },
    });

    if (!openKey) {
      throw new DatabaseError('Open key not found');
    }

    if (openKey.userid !== userid) {
      throw new DatabaseError('Unauthorized to edit this open key');
    }

    const result = await prisma.userOpenKey.update({
      where: { id },
      data: { permissions },
    });
    return result;
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }
    throw new DatabaseError(`Failed to update open key: ${id}`, error);
  }
}

export async function getOneOpenKey(id: string): Promise<any> {
  try {
    const openKey = await prisma.userOpenKey.findUnique({
      where: { id },
    });

    if (!openKey) {
      throw new DatabaseError('Open key not found');
    }

    return openKey;
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }
    throw new DatabaseError(`Failed to get open key: ${id}`, error);
  }
}
