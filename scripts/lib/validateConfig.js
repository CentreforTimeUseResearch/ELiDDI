// Checks a study config against config/config.schema.json. Shared by the
// build (../generate_no_js.js, which stops on any problem) and by
// config/config.schema.test.js. Build-time only: ajv is a devDependency and
// never reaches the browser.
import Ajv from 'ajv';

// -> validate(config): an array of human-readable problems, empty when the
// config is valid. Each names the field by its JSON path and the rule it
// breaks, e.g. `timeline/2/mode must be equal to one of the allowed values:
// single-choice, multiple-choice`.
export function createConfigValidator(schema) {
  // strict: false - the schema carries descriptive keywords ajv's strict
  // mode doesn't know
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validateSchema = ajv.compile(schema);
  return (config) => (validateSchema(config) ? [] : validateSchema.errors.map(describeProblem));
}

function describeProblem({ instancePath, message, params }) {
  const field = instancePath ? instancePath.slice(1) : '(config root)';
  const allowed = params?.allowedValues ? `: ${params.allowedValues.join(', ')}` : '';
  // name the unexpected field, e.g. a misspelt validation rule id
  const extra = params?.additionalProperty ? `: ${params.additionalProperty}` : '';
  return `${field} ${message}${allowed}${extra}`;
}
