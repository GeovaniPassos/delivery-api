import {
  PizzeriaSettingsDto,
  PizzeriaSettingsService,
} from "./pizzeria-settings.module";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
describe("Pizzeria settings", () => {
  const data = {
    name: "Pizzaria",
    address: "Rua A",
    phones: ["1111", "2222"],
    cnpj: "",
    logo: "",
  };
  it("stores and retrieves multiple phones and the profile", async () => {
    const repo = {
      upsert: jest.fn(),
      findOneBy: jest.fn().mockResolvedValue({ data }),
    };
    const service = new PizzeriaSettingsService(repo as never);
    expect(await service.save(data)).toEqual(data);
    expect(await service.get()).toEqual(data);
    expect(repo.upsert).toHaveBeenCalledWith({ id: 1, data }, ["id"]);
  });
  it("accepts an empty logo and rejects unsupported image data", async () => {
    expect(
      await validate(plainToInstance(PizzeriaSettingsDto, data)),
    ).toHaveLength(0);
    expect(
      await validate(
        plainToInstance(PizzeriaSettingsDto, {
          ...data,
          logo: "data:image/svg+xml;base64,AAAA",
        }),
      ),
    ).not.toHaveLength(0);
    expect(
      await validate(
        plainToInstance(PizzeriaSettingsDto, {
          ...data,
          phones: Array(11).fill("123"),
        }),
      ),
    ).not.toHaveLength(0);
  });
});
