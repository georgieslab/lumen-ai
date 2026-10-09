import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  BatchWriteCommand,
  UpdateCommand
} from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';

let dynamoClient;

function getClient() {
  if (!dynamoClient) {
    dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({
      region: process.env.AWS_REGION || 'eu-north-1'
    }));
  }
  return dynamoClient;
}

function requireTable() {
  const tableName = process.env.LUMEN_MEMORY_TABLE_NAME;
  if (!tableName) {
    throw new Error('Cloud memory is not configured. Set LUMEN_MEMORY_TABLE_NAME.');
  }
  return tableName;
}

async function getAllUserItems(userId) {
  const table = requireTable();
  const items = [];
  let lastEvaluatedKey;
  do {
    const result = await getClient().send(new QueryCommand({
      TableName: table,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: { ':userId': userId },
      ExclusiveStartKey: lastEvaluatedKey
    }));
    items.push(...(result.Items || []));
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);
  return items;
}

export async function getUserMemory(userId) {
  const table = requireTable();
  const [profileResult, settingsResult, memoriesResult, personaResult] = await Promise.all([
    getClient().send(new GetCommand({
      TableName: table,
      Key: { userId, recordId: 'PROFILE' }
    })),
    getClient().send(new GetCommand({
      TableName: table,
      Key: { userId, recordId: 'SETTINGS' }
    })),
    getClient().send(new QueryCommand({
      TableName: table,
      KeyConditionExpression: 'userId = :userId AND begins_with(recordId, :prefix)',
      ExpressionAttributeValues: {
        ':userId': userId,
        ':prefix': 'MEMORY#'
      },
      ScanIndexForward: false,
      Limit: 100
    })),
    getClient().send(new GetCommand({
      TableName: table,
      Key: { userId, recordId: 'PERSONA' }
    }))
  ]);

  return {
    profile: profileResult.Item?.text || '',
    autoMemoryEnabled: settingsResult.Item?.autoMemoryEnabled !== false,
    memories: (memoriesResult.Items || []).map(({ memoryId, recordId, text, createdAt, updatedAt }) => ({
      id: memoryId || recordId?.slice('MEMORY#'.length),
      text,
      createdAt,
      updatedAt
    })).filter(memory => memory.id && typeof memory.text === 'string'),
    personaCard: personaResult.Item?.personaCard || null
  };
}

export async function saveUserProfile(userId, text) {
  const now = new Date().toISOString();
  await getClient().send(new PutCommand({
    TableName: requireTable(),
    Item: { userId, recordId: 'PROFILE', text, updatedAt: now }
  }));
  await deleteUserPersonaCard(userId);
  return { text, updatedAt: now };
}

export async function saveUserPersonaCard(userId, personaCard) {
  const now = new Date().toISOString();
  await getClient().send(new PutCommand({
    TableName: requireTable(),
    Item: { userId, recordId: 'PERSONA', personaCard, updatedAt: now }
  }));
  return { personaCard, updatedAt: now };
}

export async function deleteUserPersonaCard(userId) {
  await getClient().send(new DeleteCommand({
    TableName: requireTable(),
    Key: { userId, recordId: 'PERSONA' }
  }));
}

export async function setAutoMemoryEnabled(userId, enabled) {
  const now = new Date().toISOString();
  await getClient().send(new PutCommand({
    TableName: requireTable(),
    Item: { userId, recordId: 'SETTINGS', autoMemoryEnabled: enabled, updatedAt: now }
  }));
}

export async function addUserMemory(userId, text) {
  const memoryId = randomUUID();
  const now = new Date().toISOString();
  await getClient().send(new PutCommand({
    TableName: requireTable(),
    Item: {
      userId,
      recordId: `MEMORY#${memoryId}`,
      memoryId,
      text,
      createdAt: now,
      updatedAt: now
    }
  }));
  await deleteUserPersonaCard(userId);
  return { id: memoryId, text, createdAt: now, updatedAt: now };
}

export async function updateUserMemory(userId, memoryId, text) {
  const now = new Date().toISOString();
  const result = await getClient().send(new UpdateCommand({
    TableName: requireTable(),
    Key: { userId, recordId: `MEMORY#${memoryId}` },
    UpdateExpression: 'SET #memoryText = :text, updatedAt = :updatedAt',
    ExpressionAttributeNames: { '#memoryText': 'text' },
    ExpressionAttributeValues: { ':text': text, ':updatedAt': now },
    ReturnValues: 'ALL_NEW',
    ConditionExpression: 'attribute_exists(userId) AND attribute_exists(recordId)'
  }));
  await deleteUserPersonaCard(userId);
  return {
    id: memoryId,
    text: result.Attributes?.text || text,
    createdAt: result.Attributes?.createdAt,
    updatedAt: now
  };
}

export async function deleteUserMemory(userId, memoryId) {
  await getClient().send(new DeleteCommand({
    TableName: requireTable(),
    Key: { userId, recordId: `MEMORY#${memoryId}` },
    ConditionExpression: 'attribute_exists(userId) AND attribute_exists(recordId)'
  }));
  await deleteUserPersonaCard(userId);
}

export async function clearUserMemory(userId) {
  const table = requireTable();
  const items = await getAllUserItems(userId);
  for (let offset = 0; offset < items.length; offset += 25) {
    let unprocessed = {
      [table]: items.slice(offset, offset + 25).map(({ userId: itemUserId, recordId }) => ({
        DeleteRequest: { Key: { userId: itemUserId, recordId } }
      }))
    };
    for (let attempt = 0; attempt < 5 && Object.keys(unprocessed).length > 0; attempt += 1) {
      const result = await getClient().send(new BatchWriteCommand({
        RequestItems: unprocessed
      }));
      unprocessed = result.UnprocessedItems || {};
      if (Object.keys(unprocessed).length > 0) {
        await new Promise(resolve => setTimeout(resolve, 100 * (2 ** attempt)));
      }
    }
    if (Object.values(unprocessed).some(requests => requests.length > 0)) {
      throw new Error('Some cloud memory records could not be deleted. Please try again.');
    }
  }
}
