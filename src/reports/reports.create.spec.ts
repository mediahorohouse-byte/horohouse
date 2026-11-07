import { ReportsService } from './reports.service';

const PROPERTY = '507f1f77bcf86cd799439081';
const OWNER = '507f1f77bcf86cd799439082';
const REPORTER = '507f1f77bcf86cd799439083';
const dto = { reason: 'Fraudulent / scam' };

function build(opts: { property?: any; existing?: any } = {}) {
  const save = jest.fn().mockResolvedValue({ _id: 'r1' });
  const reportModel: any = jest.fn(() => ({ save }));
  reportModel.exists = jest.fn().mockResolvedValue(opts.existing ?? null);
  const property = opts.property === undefined ? { _id: PROPERTY, ownerId: OWNER, title: 'Villa' } : opts.property;
  const propertyModel: any = { findById: jest.fn(() => ({ select: () => ({ lean: () => Promise.resolve(property) }) })) };
  const notifications: any = { notifyAdmins: jest.fn().mockResolvedValue(undefined) };
  const service = new ReportsService(reportModel, propertyModel, {} as any, {} as any, notifications);
  return { service, save, notifications };
}

describe('ReportsService.create', () => {
  it('saves the report and tells the admins', async () => {
    const { service, save, notifications } = build();
    await service.create(dto, REPORTER, PROPERTY);
    expect(save).toHaveBeenCalledTimes(1);
    expect(notifications.notifyAdmins).toHaveBeenCalledTimes(1);
  });

  it('a failed admin notice does not lose the report', async () => {
    const { service, notifications } = build();
    notifications.notifyAdmins.mockRejectedValue(new Error('mail down'));
    await expect(service.create(dto, REPORTER, PROPERTY)).resolves.toBeDefined();
  });

  it('refuses a listing that does not exist, or a bad id', async () => {
    await expect(build({ property: null }).service.create(dto, REPORTER, PROPERTY)).rejects.toThrow('not found');
    await expect(build().service.create(dto, REPORTER, 'nope')).rejects.toThrow('not found');
  });

  it('hosts cannot report their own listing', async () => {
    await expect(build().service.create(dto, OWNER, PROPERTY)).rejects.toThrow('your own');
  });

  it('one open report per person per listing', async () => {
    const { service, save } = build({ existing: { _id: 'old' } });
    await expect(service.create(dto, REPORTER, PROPERTY)).rejects.toThrow('already reported');
    expect(save).not.toHaveBeenCalled();
  });
});
