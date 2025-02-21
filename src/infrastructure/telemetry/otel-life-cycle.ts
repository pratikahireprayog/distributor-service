import { AutoInstrumentation } from './otel-auto-instrumentation';
import {
  OTEL_ENV_CONST,
  ENV_TYPE_CONST,
} from 'src/infrastructure/telemetry/telemetry.constant';

let autoInstrumentation: AutoInstrumentation | null = null;

export function isProdEnv() {
  return Boolean(process.env[OTEL_ENV_CONST.EVN_TYPE] == ENV_TYPE_CONST.PROD);
}

export function startOtel(serviceName: string, serviceVersion = '') {
  try {
    if (!isProdEnv()) {
      console.log(
        'This is not a PROD environment, so skipping opentelemetry initialization.',
      );
      return;
    }
    autoInstrumentation = new AutoInstrumentation(serviceName, serviceVersion);
    autoInstrumentation.start();
    console.log('test');
  } catch (err) {
    console.error(
      'Got exception while initializing opentelemetry auto instrumentation.',
    );
    console.error(err);
  }
}

export function shutdownOtel() {
  try {
    if (!autoInstrumentation) {
      console.log('Opentelemetry auto instrumentation is not initialized.');
      return;
    }

    if (!isProdEnv()) {
      console.log(
        'This is not a PROD environment, so skipping opentelemetry shutting down process.',
      );
      return;
    }
    autoInstrumentation.shutdown();
  } catch (err) {
    console.error(
      'Got exception while shutting down opentelemetry auto instrumentation.',
    );
    console.error(err);
  }
}
