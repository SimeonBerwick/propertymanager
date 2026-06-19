function parseFingerprints(value: string | undefined) {
  return (value ?? '')
    .split(',')
    .map((fingerprint) => fingerprint.trim())
    .filter(Boolean)
}

export function GET() {
  const packageName = process.env.ANDROID_APP_PACKAGE_NAME?.trim()
  const fingerprints = parseFingerprints(process.env.ANDROID_APP_SHA256_CERT_FINGERPRINTS)

  if (!packageName || fingerprints.length === 0) {
    return Response.json(
      { error: 'Android app links are not configured.' },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    )
  }

  return Response.json(
    [
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: packageName,
          sha256_cert_fingerprints: fingerprints,
        },
      },
    ],
    {
      headers: {
        'Cache-Control': 'public, max-age=300',
      },
    },
  )
}
