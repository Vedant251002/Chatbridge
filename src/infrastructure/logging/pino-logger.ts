import pino from "pino";
import type { AppConfig } from "../../config.js";
import type { Logger } from "../../domain/ports/logger.js";

export function createPinoLogger(
  name: string,
  config: Pick<AppConfig, "logLevel" | "nodeEnv">
): Logger {
  const transport =
    config.nodeEnv === "development"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined;

  const pinoLogger = pino({
    level: config.logLevel,
    transport,
    base: { name },
  });

  return wrap(pinoLogger);
}

function wrap(pinoInstance: pino.Logger): Logger {
  return {
    info: (message, context) => pinoInstance.info(context ?? {}, message),
    warn: (message, context) => pinoInstance.warn(context ?? {}, message),
    error: (message, context) => pinoInstance.error(context ?? {}, message),
    debug: (message, context) => pinoInstance.debug(context ?? {}, message),
    child: (bindings) => wrap(pinoInstance.child(bindings)),
  };
}
