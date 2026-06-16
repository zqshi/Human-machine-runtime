import { describe, it, expect } from 'vitest';
import { OpenApiParser } from './openapi-parser.js';

const parser = new OpenApiParser();

describe('OpenApiParser', () => {
  describe('OAS 3.0 JSON', () => {
    const spec = JSON.stringify({
      openapi: '3.0.3',
      info: { title: 'Pet Store', version: '1.0.0' },
      servers: [{ url: 'https://api.petstore.io/v1' }],
      paths: {
        '/pets': {
          get: {
            operationId: 'listPets',
            summary: 'List all pets',
            tags: ['pets'],
            parameters: [
              { name: 'limit', in: 'query', required: false, schema: { type: 'integer' } },
            ],
            responses: {
              '200': {
                description: 'A list of pets',
                content: {
                  'application/json': {
                    schema: { type: 'array', items: { type: 'object' } },
                  },
                },
              },
            },
          },
          post: {
            operationId: 'createPet',
            summary: 'Create a pet',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      tag: { type: 'string' },
                    },
                    required: ['name'],
                  },
                },
              },
            },
            responses: {
              '201': { description: 'Created' },
            },
          },
        },
        '/pets/{petId}': {
          get: {
            operationId: 'getPetById',
            summary: 'Get pet by ID',
            parameters: [{ name: 'petId', in: 'path', required: true, schema: { type: 'string' } }],
            responses: {
              '200': {
                description: 'A pet',
                content: { 'application/json': { schema: { type: 'object' } } },
              },
            },
          },
        },
      },
    });

    it('should parse all operations', () => {
      const result = parser.parse(spec);
      expect(result.errors).toHaveLength(0);
      expect(result.tools).toHaveLength(3);
      expect(result.specVersion).toBe('3.0.3');
      expect(result.title).toBe('Pet Store');
      expect(result.baseUrl).toBe('https://api.petstore.io/v1');
    });

    it('should extract correct tool names from operationId', () => {
      const result = parser.parse(spec);
      const names = result.tools.map((t) => t.name);
      expect(names).toContain('listPets');
      expect(names).toContain('createPet');
      expect(names).toContain('getPetById');
    });

    it('should build input schema for GET with query param', () => {
      const result = parser.parse(spec);
      const listPets = result.tools.find((t) => t.name === 'listPets')!;
      expect(listPets.method).toBe('GET');
      expect(listPets.path).toBe('/pets');
      expect(listPets.inputSchema).toMatchObject({
        type: 'object',
        properties: {
          limit: { type: 'integer' },
        },
      });
    });

    it('should build input schema for POST with request body', () => {
      const result = parser.parse(spec);
      const createPet = result.tools.find((t) => t.name === 'createPet')!;
      expect(createPet.method).toBe('POST');
      expect(createPet.inputSchema).toMatchObject({
        type: 'object',
        properties: {
          body: expect.objectContaining({ type: 'object' }),
        },
        required: ['body'],
      });
    });

    it('should mark path params as required', () => {
      const result = parser.parse(spec);
      const getPet = result.tools.find((t) => t.name === 'getPetById')!;
      expect(getPet.inputSchema).toMatchObject({
        type: 'object',
        required: ['petId'],
      });
    });

    it('should extract response schema', () => {
      const result = parser.parse(spec);
      const listPets = result.tools.find((t) => t.name === 'listPets')!;
      expect(listPets.outputSchema).toMatchObject({ type: 'array' });
    });

    it('should set execution type to http_proxy', () => {
      const result = parser.parse(spec);
      for (const tool of result.tools) {
        expect(tool.executionType).toBe('http_proxy');
        expect(tool.executionConfig).toMatchObject({
          baseUrl: 'https://api.petstore.io/v1',
        });
      }
    });
  });

  describe('OAS 3.0 with security schemes', () => {
    it('should detect apiKey auth', () => {
      const spec = JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'Secured API', version: '1.0' },
        components: {
          securitySchemes: {
            apiKey: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
          },
        },
        paths: {
          '/data': { get: { operationId: 'getData', responses: { '200': { description: 'ok' } } } },
        },
      });
      const result = parser.parse(spec);
      expect(result.tools[0].authMethod).toBe('api_key');
    });

    it('should detect bearer auth', () => {
      const spec = JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'Bearer API', version: '1.0' },
        components: {
          securitySchemes: {
            bearer: { type: 'http', scheme: 'bearer' },
          },
        },
        paths: {
          '/me': { get: { operationId: 'getMe', responses: { '200': { description: 'ok' } } } },
        },
      });
      const result = parser.parse(spec);
      expect(result.tools[0].authMethod).toBe('bearer');
    });
  });

  describe('Swagger 2.0', () => {
    const spec = JSON.stringify({
      swagger: '2.0',
      info: { title: 'Legacy API', version: '1.0' },
      host: 'api.legacy.com',
      basePath: '/v1',
      paths: {
        '/users': {
          get: {
            operationId: 'listUsers',
            summary: 'List users',
            parameters: [{ name: 'page', in: 'query', type: 'integer' }],
            responses: { '200': { description: 'ok' } },
          },
        },
      },
    });

    it('should parse Swagger 2.0 spec', () => {
      const result = parser.parse(spec);
      expect(result.specVersion).toBe('2.0');
      expect(result.baseUrl).toBe('https://api.legacy.com/v1');
      expect(result.tools).toHaveLength(1);
    });

    it('should handle Swagger 2.0 parameter format', () => {
      const result = parser.parse(spec);
      const tool = result.tools[0];
      expect(tool.inputSchema).toMatchObject({
        type: 'object',
        properties: { page: { type: 'integer' } },
      });
    });
  });

  describe('$ref resolution', () => {
    it('should resolve component schema refs', () => {
      const spec = JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'Ref API', version: '1.0' },
        paths: {
          '/items': {
            get: {
              operationId: 'listItems',
              responses: {
                '200': {
                  description: 'ok',
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/ItemList' },
                    },
                  },
                },
              },
            },
          },
        },
        components: {
          schemas: {
            ItemList: { type: 'array', items: { type: 'object' } },
          },
        },
      });
      const result = parser.parse(spec);
      expect(result.tools[0].outputSchema).toMatchObject({ type: 'array' });
    });
  });

  describe('edge cases', () => {
    it('should return error for empty spec', () => {
      const result = parser.parse('{}');
      expect(result.errors).toContain('spec 中未找到 paths 定义');
      expect(result.tools).toHaveLength(0);
    });

    it('should return error for invalid JSON', () => {
      const result = parser.parse('not valid json or yaml {{{');
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should generate name from path when no operationId', () => {
      const spec = JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'NoOp API', version: '1.0' },
        paths: {
          '/api/v1/users/{userId}/orders': {
            get: { responses: { '200': { description: 'ok' } } },
          },
        },
      });
      const result = parser.parse(spec);
      expect(result.tools[0].name).toBe('get_api_v1_users_by_userId_orders');
    });

    it('should handle operation with no parameters or body', () => {
      const spec = JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'Simple API', version: '1.0' },
        paths: {
          '/health': {
            get: { operationId: 'healthCheck', responses: { '200': { description: 'ok' } } },
          },
        },
      });
      const result = parser.parse(spec);
      expect(result.tools[0].inputSchema).toEqual({});
    });
  });
});
