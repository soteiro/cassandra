const fs = require('fs');
const path = require('path');

const BRUNO_DIR = path.resolve(__dirname, '../bruno/cassandra api');
const OUTPUT_DIR = path.resolve(__dirname, '../frontend/public/docs');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'openapi.json');

// Función simple para parsear el formato YAML de Bruno sin dependencias externas
function parseBrunoYaml(content) {
  const result = {};
  const lines = content.split(/\r?\n/);
  
  let currentSection = null;
  let currentSubSection = null;
  let inMultiline = false;
  let multilineKey = '';
  let multilineIndent = 0;
  let multilineBuffer = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (inMultiline) {
      const indent = line.search(/\S|$/);
      if (indent > multilineIndent && trimmed.length > 0) {
        multilineBuffer.push(line.slice(multilineIndent + 2));
        continue;
      } else if (trimmed.length === 0) {
        multilineBuffer.push('');
        continue;
      } else {
        // Fin del multiline
        const val = multilineBuffer.join('\n').trim();
        if (currentSubSection && currentSection) {
          result[currentSection][currentSubSection][multilineKey] = val;
        } else if (currentSection) {
          result[currentSection][multilineKey] = val;
        }
        inMultiline = false;
        multilineBuffer = [];
      }
    }

    if (!trimmed || trimmed.startsWith('#')) continue;

    // Sección principal (ej: "info:", "http:", "settings:")
    if (/^[a-zA-Z0-9_-]+:$/.test(trimmed)) {
      currentSection = trimmed.replace(':', '');
      result[currentSection] = {};
      currentSubSection = null;
      continue;
    }

    // Multiline block scalar (ej: "data: |-" o "docs: |-")
    if (trimmed.includes(': |-') || trimmed.includes(': |')) {
      const parts = trimmed.split(':');
      multilineKey = parts[0].trim();
      multilineIndent = line.search(/\S/);
      inMultiline = true;
      multilineBuffer = [];
      continue;
    }

    // Subsección (ej: "  body:", "  scripts:")
    if (/^\s{2}[a-zA-Z0-9_-]+:$/.test(line)) {
      currentSubSection = trimmed.replace(':', '');
      if (currentSection) {
        result[currentSection][currentSubSection] = {};
      }
      continue;
    }

    // Clave-valor estándar
    if (trimmed.includes(':')) {
      const colonIdx = trimmed.indexOf(':');
      const key = trimmed.slice(0, colonIdx).trim();
      let val = trimmed.slice(colonIdx + 1).trim();

      // Quitar comillas si las tiene
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }

      if (currentSubSection && currentSection) {
        result[currentSection][currentSubSection][key] = val;
      } else if (currentSection) {
        result[currentSection][key] = val;
      }
    }
  }

  if (inMultiline) {
    const val = multilineBuffer.join('\n').trim();
    if (currentSubSection && currentSection) {
      result[currentSection][currentSubSection][multilineKey] = val;
    } else if (currentSection) {
      result[currentSection][multilineKey] = val;
    }
  }

  return result;
}

// Genera un esquema JSON básico a partir de un objeto JavaScript
function inferJsonSchema(val) {
  if (val === null) return { type: 'string', nullable: true };
  if (Array.isArray(val)) {
    return {
      type: 'array',
      items: val.length > 0 ? inferJsonSchema(val[0]) : { type: 'string' }
    };
  }
  if (typeof val === 'object') {
    const properties = {};
    for (const [k, v] of Object.entries(val)) {
      properties[k] = inferJsonSchema(v);
    }
    return {
      type: 'object',
      properties
    };
  }
  if (typeof val === 'number') {
    return Number.isInteger(val) ? { type: 'integer' } : { type: 'number' };
  }
  if (typeof val === 'boolean') return { type: 'boolean' };
  return { type: 'string' };
}

// Normaliza URLs a formato OpenAPI /api/proyects/{id}
function normalizeUrlAndExtractParams(rawUrl) {
  let pathname = rawUrl;
  try {
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
      const u = new URL(rawUrl);
      pathname = u.pathname;
    }
  } catch (e) {
    pathname = rawUrl.replace(/^https?:\/\/[^/]+/, '');
  }

  // Si la URL contiene variables de bruno como {{id}} o :id
  pathname = pathname.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, '{$1}');
  pathname = pathname.replace(/:([a-zA-Z0-9_]+)/g, '{$1}');

  const parameters = [];
  const segments = pathname.split('/');
  const normalizedSegments = segments.map((seg, idx) => {
    // Si es un número puro en una posición de ID (ej: /api/personas/1 -> /api/personas/{id})
    if (/^\d+$/.test(seg)) {
      const prevSeg = segments[idx - 1] || 'item';
      const singular = prevSeg.endsWith('s') ? prevSeg.slice(0, -1) : prevSeg;
      const paramName = `${singular}_id`;
      parameters.push({
        name: paramName,
        in: 'path',
        required: true,
        schema: { type: 'integer', example: parseInt(seg, 10) },
        description: `ID numérico de ${singular}`
      });
      return `{${paramName}}`;
    }
    // Si ya es un placeholder {param}
    if (seg.startsWith('{') && seg.endsWith('}')) {
      const pName = seg.slice(1, -1);
      parameters.push({
        name: pName,
        in: 'path',
        required: true,
        schema: { type: 'string' },
        description: `Parámetro ${pName}`
      });
    }
    return seg;
  });

  return {
    path: normalizedSegments.join('/'),
    parameters
  };
}

function generateOpenApi() {
  const openapi = {
    openapi: '3.0.3',
    info: {
      title: 'Cassandra API Reference',
      version: '1.0.0',
      description: 'Documentación viva de la API autogenerada a partir de las colecciones de Bruno.'
    },
    servers: [
      { url: 'http://localhost:8080', description: 'Servidor Local' },
      { url: '/', description: 'Servidor Actual' }
    ],
    tags: [],
    paths: {},
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Token JWT de autenticación'
        }
      }
    }
  };

  if (!fs.existsSync(BRUNO_DIR)) {
    console.error(`❌ No se encontró el directorio de Bruno en: ${BRUNO_DIR}`);
    process.exit(1);
  }

  const tagNames = new Set();
  const entries = fs.readdirSync(BRUNO_DIR, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === 'environments') {
      continue;
    }

    const folderName = entry.name;
    const tagName = folderName.charAt(0).toUpperCase() + folderName.slice(1);
    if (!tagNames.has(tagName)) {
      tagNames.add(tagName);
      openapi.tags.push({ name: tagName, description: `Operaciones de ${tagName}` });
    }

    const folderPath = path.join(BRUNO_DIR, folderName);
    const files = fs.readdirSync(folderPath);

    for (const file of files) {
      if (!file.endsWith('.yml') || file === 'folder.yml') continue;

      const filePath = path.join(folderPath, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const parsed = parseBrunoYaml(content);

      if (!parsed.http || !parsed.http.method || !parsed.http.url) continue;

      const method = parsed.http.method.toLowerCase();
      const rawUrl = parsed.http.url;
      const { path: apiPath, parameters } = normalizeUrlAndExtractParams(rawUrl);

      if (!openapi.paths[apiPath]) {
        openapi.paths[apiPath] = {};
      }

      const operationName = parsed.info?.name || file.replace('.yml', '');
      const operationId = `${method}_${apiPath.replace(/[^a-zA-Z0-9]/g, '_')}`;

      const operation = {
        tags: [tagName],
        summary: operationName,
        operationId,
        parameters: parameters.length > 0 ? parameters : undefined,
        responses: {
          '200': {
            description: 'Operación exitosa',
            content: {
              'application/json': {
                schema: { type: 'object' }
              }
            }
          },
          '400': { description: 'Solicitud inválida' },
          '401': { description: 'No autorizado / Token inválido' },
          '500': { description: 'Error interno del servidor' }
        }
      };

      // Si es ruta autenticada
      if (!apiPath.includes('/auth/login') && !apiPath.includes('/auth/refresh')) {
        operation.security = [{ bearerAuth: [] }];
      }

      // Procesar Body JSON si existe
      if (parsed.http.body && parsed.http.body.data) {
        try {
          const bodyJson = JSON.parse(parsed.http.body.data);
          operation.requestBody = {
            required: true,
            content: {
              'application/json': {
                schema: inferJsonSchema(bodyJson),
                example: bodyJson
              }
            }
          };
        } catch (e) {
          operation.requestBody = {
            required: true,
            content: {
              'application/json': {
                schema: { type: 'object' }
              }
            }
          };
        }
      }

      openapi.paths[apiPath][method] = operation;
    }
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(openapi, null, 2), 'utf8');
  console.log(`✅ Documentación OpenAPI generada exitosamente en: ${OUTPUT_FILE}`);
}

generateOpenApi();
