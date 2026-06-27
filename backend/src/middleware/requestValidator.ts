import { Request, Response, NextFunction } from "express";

export interface SchemaField {
  type: "string" | "number" | "boolean" | "integer";
  required?: boolean;
  min?: number; // length for string, value for number/integer
  max?: number; // length for string, value for number/integer
  pattern?: RegExp;
  enum?: string[];
}

export interface RequestSchema {
  body?: Record<string, SchemaField>;
  query?: Record<string, SchemaField>;
  params?: Record<string, SchemaField>;
}

function coerceAndValidate(
  value: any,
  rule: SchemaField,
  location: string,
  fieldName: string
): { valid: boolean; value?: any; error?: string } {
  if (value === undefined || value === null) {
    if (rule.required) {
      return {
        valid: false,
        error: `Field '${fieldName}' in ${location} is required.`,
      };
    }
    return { valid: true };
  }

  let coerced = value;

  if (rule.type === "integer") {
    const parsed = parseInt(value, 10);
    if (isNaN(parsed) || String(parsed) !== String(value).trim()) {
      return {
        valid: false,
        error: `Field '${fieldName}' in ${location} must be a valid integer.`,
      };
    }
    coerced = parsed;
    if (rule.min !== undefined && coerced < rule.min) {
      return {
        valid: false,
        error: `Field '${fieldName}' in ${location} must be at least ${rule.min}.`,
      };
    }
    if (rule.max !== undefined && coerced > rule.max) {
      return {
        valid: false,
        error: `Field '${fieldName}' in ${location} must be at most ${rule.max}.`,
      };
    }
  } else if (rule.type === "number") {
    const parsed = parseFloat(value);
    if (isNaN(parsed)) {
      return {
        valid: false,
        error: `Field '${fieldName}' in ${location} must be a valid number.`,
      };
    }
    coerced = parsed;
    if (rule.min !== undefined && coerced < rule.min) {
      return {
        valid: false,
        error: `Field '${fieldName}' in ${location} must be at least ${rule.min}.`,
      };
    }
    if (rule.max !== undefined && coerced > rule.max) {
      return {
        valid: false,
        error: `Field '${fieldName}' in ${location} must be at most ${rule.max}.`,
      };
    }
  } else if (rule.type === "boolean") {
    if (typeof value === "boolean") {
      coerced = value;
    } else if (value === "true") {
      coerced = true;
    } else if (value === "false") {
      coerced = false;
    } else {
      return {
        valid: false,
        error: `Field '${fieldName}' in ${location} must be a valid boolean.`,
      };
    }
  } else if (rule.type === "string") {
    if (typeof value !== "string") {
      return {
        valid: false,
        error: `Field '${fieldName}' in ${location} must be a string.`,
      };
    }
    coerced = value;
    if (rule.min !== undefined && coerced.length < rule.min) {
      return {
        valid: false,
        error: `Field '${fieldName}' in ${location} must have length at least ${rule.min}.`,
      };
    }
    if (rule.max !== undefined && coerced.length > rule.max) {
      return {
        valid: false,
        error: `Field '${fieldName}' in ${location} must have length at most ${rule.max}.`,
      };
    }
    if (rule.pattern && !rule.pattern.test(coerced)) {
      return {
        valid: false,
        error: `Field '${fieldName}' in ${location} format is invalid.`,
      };
    }
    if (rule.enum && !rule.enum.includes(coerced)) {
      return {
        valid: false,
        error: `Field '${fieldName}' in ${location} must be one of: ${rule.enum.join(
          ", "
        )}.`,
      };
    }
  }

  return { valid: true, value: coerced };
}

export function validate(schema: RequestSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: string[] = [];

    // Validate params
    if (schema.params) {
      for (const [key, rule] of Object.entries(schema.params)) {
        const result = coerceAndValidate(req.params[key], rule, "params", key);
        if (!result.valid) {
          errors.push(result.error!);
        } else if (result.value !== undefined) {
          req.params[key] = String(result.value);
        }
      }
    }

    // Validate query
    if (schema.query) {
      for (const [key, rule] of Object.entries(schema.query)) {
        const result = coerceAndValidate(req.query[key], rule, "query", key);
        if (!result.valid) {
          errors.push(result.error!);
        } else if (result.value !== undefined) {
          req.query[key] = result.value;
        }
      }
    }

    // Validate body
    if (schema.body) {
      for (const [key, rule] of Object.entries(schema.body)) {
        const result = coerceAndValidate(req.body[key], rule, "body", key);
        if (!result.valid) {
          errors.push(result.error!);
        } else if (result.value !== undefined) {
          req.body[key] = result.value;
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        error: "Validation Failed",
        messages: errors,
      });
    }

    next();
  };
}
