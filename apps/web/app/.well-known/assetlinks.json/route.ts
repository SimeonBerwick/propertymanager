const DEFAULT_ANDROID_APP_PACKAGE_NAME = 'com.simeonberwick.propertymanager'
const DEFAULT_ANDROID_APP_SHA256_CERT_FINGERPRINTS = [
  '38:57:F3:C1:39:5C:C7:51:AD:DB:8D:DD:C5:8E:F9:FA:49:9E:B5:69:55:CD:D7:C4:F7:29:70:DD:C6:9A:24:2E',
  'EC:0D:77:8D:C9:DE:7B:93:D2:6C:9A:9C:B4:E7:3C:94:0A:F8:EE:7F:E1:33:D5:8A:18:33:C7:FC:53:52:38:C3',
]

function parseFingerprints(value: string | undefined) {
  return (value ?? '')
    .split(',')
    .map((fingerprint) => fingerprint.trim())
    .filter(Boolean)
}

export function GET() {
  const packageName = process.env.ANDROID_APP_PACKAGE_NAME?.trim() || DEFAULT_ANDROID_APP_PACKAGE_NAME
  const fingerprints = Array.from(
    new Set([
      ...DEFAULT_ANDROID_APP_SHA256_CERT_FINGERPRINTS,
      ...parseFingerprints(process.env.ANDROID_APP_SHA256_CERT_FINGERPRINTS),
    ]),
  )

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
