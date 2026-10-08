import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  PizzeriaSettingsService,
  PizzeriaThemeDto,
} from './pizzeria-settings.module';

describe('Company theme', () => {
  it('defaults existing company profiles to light', async () => {
    const service = new PizzeriaSettingsService({
      findOneBy: async () => ({ data: { name: 'Empresa' } }),
    } as never);
    expect(await service.get()).toMatchObject({
      name: 'Empresa',
      theme: 'light',
    });
  });
  it('validates theme values', async () => {
    expect(
      await validate(plainToInstance(PizzeriaThemeDto, { theme: 'light' })),
    ).toHaveLength(0);
    expect(
      await validate(plainToInstance(PizzeriaThemeDto, { theme: 'invalid' })),
    ).not.toHaveLength(0);
  });
  it('updates only the theme without overwriting company fields', async () => {
    const query = jest
      .fn()
      .mockResolvedValue([{ data: { name: 'Empresa', theme: 'light' } }]);
    const service = new PizzeriaSettingsService({ query } as never);
    expect(await service.saveTheme('light')).toMatchObject({
      name: 'Empresa',
      theme: 'light',
    });
    expect(query.mock.calls[0][0]).toContain(
      "jsonb_build_object('theme', $2::text)",
    );
    expect(query.mock.calls[0][1][1]).toBe('light');
  });
  it('preserves the database theme when saving a stale company form', async () => {
    const query = jest
      .fn()
      .mockResolvedValue([{ data: { name: 'Empresa', theme: 'light' } }]);
    const service = new PizzeriaSettingsService({ query } as never);
    expect(
      await service.save({
        name: 'Empresa',
        address: '',
        phones: [],
        cnpj: '',
        logo: '',
        theme: 'dark',
      }),
    ).toMatchObject({ theme: 'light' });
    expect(query.mock.calls[0][0]).toContain("EXCLUDED.data - 'theme'");
  });
});
