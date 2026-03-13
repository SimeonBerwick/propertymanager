import { PrismaClient, RequestCategory, RequestEventType, RequestStatus, RequestUrgency, TenantStatus, UserRole, EventVisibility } from '@prisma/client';
import { hashPassword } from '../lib/passwords';

const prisma = new PrismaClient();

async function main() {
  await prisma.invite.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.requestEvent.deleteMany();
  await prisma.maintenanceRequest.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.unit.deleteMany();
  await prisma.property.deleteMany();
  await prisma.region.deleteMany();
  await prisma.appUser.deleteMany();
  await prisma.organization.deleteMany();

  const [operatorPasswordHash, vendorPasswordHash, tenantPasswordHash] = await Promise.all([
    hashPassword('operator123'),
    hashPassword('vendor123'),
    hashPassword('tenant123'),
  ]);

  const organization = await prisma.organization.create({
    data: {
      name: 'Sunset Property Group',
      users: {
        create: [
          {
            name: 'Olivia Operator',
            email: 'olivia@example.com',
            role: UserRole.OPERATOR,
            passwordHash: operatorPasswordHash,
          },
        ],
      },
      vendors: {
        create: [
          {
            name: 'Ace Plumbing',
            trade: 'Plumbing',
            phone: '555-2222',
            email: 'dispatch@aceplumbing.test',
            passwordHash: vendorPasswordHash,
          },
        ],
      },
    },
    include: {
      users: true,
      vendors: true,
    },
  });

  const [phoenixMetro] = await Promise.all([
    prisma.region.create({
      data: {
        organizationId: organization.id,
        name: 'Phoenix Metro',
        slug: 'phoenix-metro',
        notes: 'Core metro service area with the densest request volume.',
      },
    }),
    prisma.region.create({
      data: {
        organizationId: organization.id,
        name: 'West Valley',
        slug: 'west-valley',
        notes: 'Secondary service area for growth and overflow coverage.',
      },
    }),
  ]);

  const property = await prisma.property.create({
    data: {
      organizationId: organization.id,
      regionId: phoenixMetro.id,
      name: 'Desert Bloom Apartments',
      addressLine1: '101 Main Street',
      city: 'Phoenix',
      state: 'AZ',
      postalCode: '85001',
      units: {
        create: [
          {
            label: '1A',
            bedroomCount: 2,
            bathroomCount: 1,
            occupancyStatus: 'occupied',
            tenants: {
              create: [
                {
                  name: 'Tina Tenant',
                  email: 'tina@example.com',
                  phone: '555-0101',
                  status: TenantStatus.ACTIVE,
                  passwordHash: tenantPasswordHash,
                },
              ],
            },
          },
          { label: '2B', bedroomCount: 1, bathroomCount: 1, occupancyStatus: 'vacant' },
        ],
      },
    },
    include: { units: { include: { tenants: true } } },
  });

  const unit = property.units[0];
  const tenant = unit.tenants[0];
  const operator = organization.users.find((user) => user.role === UserRole.OPERATOR)!;
  const vendor = organization.vendors[0];

  const request = await prisma.maintenanceRequest.create({
    data: {
      propertyId: property.id,
      unitId: unit.id,
      tenantId: tenant.id,
      createdByRole: UserRole.TENANT,
      title: 'Kitchen sink leak',
      description: 'Water is dripping under the sink and pooling inside the cabinet.',
      category: RequestCategory.PLUMBING,
      urgency: RequestUrgency.HIGH,
      status: RequestStatus.SCHEDULED,
      assignedVendorId: vendor.id,
      scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000),
      events: {
        create: [
          {
            type: RequestEventType.STATUS_CHANGED,
            actorRole: UserRole.TENANT,
            actorName: tenant.name,
            body: 'Request submitted with status NEW.',
            visibility: EventVisibility.ALL,
          },
          {
            type: RequestEventType.VENDOR_ASSIGNED,
            actorRole: UserRole.OPERATOR,
            actorUserId: operator.id,
            actorName: operator.name,
            body: 'Assigned Ace Plumbing to investigate and repair.',
            visibility: EventVisibility.INTERNAL,
          },
          {
            type: RequestEventType.SCHEDULE_SET,
            actorRole: UserRole.OPERATOR,
            actorUserId: operator.id,
            actorName: operator.name,
            body: 'Visit scheduled for tomorrow morning.',
            visibility: EventVisibility.ALL,
          },
        ],
      },
      attachments: {
        create: [
          {
            uploaderRole: UserRole.TENANT,
            storagePath: '/seed/kitchen-sink-leak.png',
            mimeType: 'image/png',
          },
        ],
      },
    },
  });

  console.log(`Seeded organization ${organization.name} with request ${request.id}`);
  console.log('Demo credentials:');
  console.log('  Operator: olivia@example.com / operator123');
  console.log('  Tenant:   tina@example.com / tenant123');
  console.log('  Vendor:   dispatch@aceplumbing.test / vendor123');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
