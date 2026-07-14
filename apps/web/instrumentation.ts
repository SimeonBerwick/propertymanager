import type { Instrumentation } from 'next'
import { captureSentryException } from '@/lib/sentry-reporting'

export async function register() {}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  await captureSentryException(error, {
    area: `next.${context.routerKind}.${context.routeType}`,
    path: request.path,
    method: request.method,
    tags: { routePath: context.routePath, renderSource: context.renderSource },
  })
}
