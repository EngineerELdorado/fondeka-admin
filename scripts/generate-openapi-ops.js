const fs = require('fs');
const path = require('path');

const specPath = path.join(__dirname, '..', 'docs', 'admin-openapi.json');
const outputPath = path.join(__dirname, '..', 'docs', 'admin-openapi-ops.json');

const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const schemas = spec.components?.schemas || {};

const slugify = (str) => str
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/(^-|-$)/g, '') || 'misc';

const resolveRef = (ref) => {
  if (!ref.startsWith('#/components/schemas/')) return null;
  const key = ref.replace('#/components/schemas/', '');
  return schemas[key];
};

const sampleFromSchema = (schema, depth = 0) => {
  if (!schema || depth > 3) return null;
  if (schema.$ref) return sampleFromSchema(resolveRef(schema.$ref), depth + 1);
  if (schema.allOf?.length) return sampleFromSchema(schema.allOf[0], depth + 1);

  if (schema.enum?.length) return schema.enum[0];

  switch (schema.type) {
    case 'object': {
      const out = {};
      const props = schema.properties || {};
      Object.keys(props).slice(0, 15).forEach((key) => {
        out[key] = sampleFromSchema(props[key], depth + 1);
      });
      return out;
    }
    case 'array':
      return [sampleFromSchema(schema.items, depth + 1)];
    case 'integer':
    case 'number':
      return 0;
    case 'boolean':
      return false;
    case 'string':
    default:
      if (schema.format === 'date-time') return new Date().toISOString();
      return '';
  }
};

const titleCase = (str) => str
  .replace(/([a-z])([A-Z])/g, '$1 $2')
  .replace(/Controller$/, '')
  .replace(/^Admin/, '')
  .replace(/_/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  || 'Misc';

const operationsByTag = {};

Object.entries(spec.paths || {}).forEach(([pathName, methods]) => {
  Object.entries(methods).forEach(([method, op]) => {
    const tag = op.tags?.[0] || 'Admin';
    const cleanedPath = (pathName.startsWith('/admin-api') ? pathName.replace('/admin-api', '') : pathName) || '/';
    const opKey = slugify(`${method}-${cleanedPath.replace(/[{}]/g, '')}`);
    const requestSchema = op.requestBody?.content?.['application/json']?.schema;
    const sample = requestSchema ? sampleFromSchema(requestSchema) : undefined;
    const queryParams = (op.parameters || []).filter((p) => p.in === 'query').map((p) => p.name);
    const pathParams = (cleanedPath.match(/{([^}]+)}/g) || []).map((p) => p.replace(/[{}]/g, ''));
    if (!operationsByTag[tag]) operationsByTag[tag] = [];
    operationsByTag[tag].push({
      key: opKey,
      method: method.toUpperCase(),
      path: cleanedPath,
      label: op.summary || op.operationId || `${method.toUpperCase()} ${cleanedPath}`,
      hasBody: Boolean(requestSchema),
      sampleBody: sample ? JSON.stringify(sample, null, 2) : undefined,
      queryParams,
      pathParams
    });
  });
});

const domains = Object.entries(operationsByTag)
  .map(([tag, ops]) => ({
    key: slugify(tag),
    tag,
    label: titleCase(tag),
    operations: ops.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method))
  }))
  .sort((a, b) => a.label.localeCompare(b.label));

const output = {
  generatedAt: new Date().toISOString(),
  domains
};

fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
console.log(`Wrote ${output.domains.length} domains to ${outputPath}`);
