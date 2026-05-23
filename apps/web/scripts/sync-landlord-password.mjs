import { execFileSync } from 'node:child_process'
import { randomBytes, scryptSync } from 'node:crypto'

const PASSWORD_PREFIX = 'scrypt'
const KEY_LENGTH = 64

function requiredEnv(name) {
  const raw = process.env[name]
  if (!raw) {
    throw new Error(`${name} is required`)
  }

  return raw.replace(/^"/, '').replace(/"$/, '')
}

function sqlString(value) {
  return `'${value.replaceAll("'", "''")}'`
}

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, KEY_LENGTH).toString('hex')
  return `${PASSWORD_PREFIX}:${salt}:${hash}`
}

const databaseUrl = requiredEnv('DATABASE_URL')
const landlordEmail = requiredEnv('LANDLORD_EMAIL').trim().toLowerCase()
const landlordPassword = requiredEnv('LANDLORD_PASSWORD')
const passwordHash = hashPassword(landlordPassword)

const countSql = `select count(*) from "User" where email = ${sqlString(landlordEmail)} and role = 'landlord';`
const matchCount = execFileSync('psql', [databaseUrl, '-At', '-c', countSql], {
  encoding: 'utf8',
}).trim()

if (matchCount === '0') {
  const landlordRows = execFileSync(
    'psql',
    [databaseUrl, '-At', '-F', '\t', '-c', `select id, email from "User" where role = 'landlord' order by email;`],
    { encoding: 'utf8' },
  )
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [id, email] = line.split('\t')
      return { id, email }
    })

  if (landlordRows.length !== 1) {
    throw new Error(`Expected exactly one landlord user overall when env email mismatches, found ${landlordRows.length}.`)
  }

  const onlyLandlord = landlordRows[0]
  const realignSql = `
    update "User"
    set email = ${sqlString(landlordEmail)},
        "passwordHash" = ${sqlString(passwordHash)}
    where id = ${sqlString(onlyLandlord.id)};
  `

  execFileSync('psql', [databaseUrl, '-v', 'ON_ERROR_STOP=1', '-c', realignSql], {
    stdio: 'inherit',
  })

  process.stdout.write(`Realigned landlord user ${onlyLandlord.email} -> ${landlordEmail} and synced password.\n`)
  process.exit(0)
}

if (matchCount !== '1') {
  throw new Error(`Expected exactly one landlord user for ${landlordEmail}, found ${matchCount}.`)
}

const updateSql = `
  update "User"
  set "passwordHash" = ${sqlString(passwordHash)}
  where email = ${sqlString(landlordEmail)}
    and role = 'landlord';
`

execFileSync('psql', [databaseUrl, '-v', 'ON_ERROR_STOP=1', '-c', updateSql], {
  stdio: 'inherit',
})

process.stdout.write(`Synced landlord password for ${landlordEmail}.\n`)
