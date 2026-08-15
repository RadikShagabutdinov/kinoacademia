import { describe, expect, it } from 'vitest';
import {
  ACTIVE_CONTRACT_STATUSES,
  AdminPersonDto,
  ApiError,
  BranchCode,
  CAPITALIZATION_PER_EMPLOYEE_CAP,
  CONTRACT_TRANSITIONS,
  CompanyDto,
  CompanyRatingDto,
  ContractActionInput,
  ContractDto,
  ContractErrorCode,
  ContractKind,
  ContractStatusCode,
  ContractStatusHistoryDto,
  ContractsHistoryQuery,
  CreateScanSetInput,
  CreateUserInput,
  JobDefinitionDto,
  JobKey,
  JobRunDto,
  JobStatus,
  LoginInput,
  NominationCode,
  OscarDto,
  OscarWithdrawResultDto,
  PersonDto,
  PersonRatingAdminDto,
  PersonRatingDto,
  RaceCode,
  RatingTransactionDto,
  RoleCode,
  SCAN_ALLOWED_MIME,
  SCAN_MAX_PAGES,
  SHARED_VERSION,
  ScanErrorCode,
  ScanSetDto,
  TransferRatingInput,
  UpdateJobInput,
  UserDto,
  WsEventEnvelope,
  canTransition,
  computeBreakupPenalty,
  computeNominationCost,
} from './index';

const NOW = '2026-04-29T18:00:00.000Z';
const UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

describe('shared smoke', () => {
  it('exports version', () => {
    expect(SHARED_VERSION).toBe('0.1.0');
  });
});

describe('lookups', () => {
  it.each([
    [RoleCode, 'admin', 'nope'],
    [RaceCode, 'vamp-corv', 'elf'],
    [BranchCode, 'cinema', 'space'],
    [ContractKind, 'permanent', 'eternal'],
    [ContractStatusCode, 'draft', 'unknown'],
    [NominationCode, 'best_film', 'best_meme'],
  ])('parses valid and rejects invalid codes', (schema, valid, invalid) => {
    expect(schema.parse(valid)).toBe(valid);
    expect(schema.safeParse(invalid).success).toBe(false);
  });
});

describe('user schemas', () => {
  it('LoginInput requires login and password', () => {
    expect(LoginInput.safeParse({ login: 'admin', password: '12345678' }).success).toBe(true);
    expect(LoginInput.safeParse({ login: 'ad', password: '12345678' }).success).toBe(false);
    expect(LoginInput.safeParse({ login: 'admin', password: '123' }).success).toBe(false);
    expect(LoginInput.safeParse({ login: 'with space', password: '12345678' }).success).toBe(false);
  });

  it('CreateUserInput validates role', () => {
    const ok = CreateUserInput.safeParse({
      login: 'player1',
      roleCode: 'emp',
    });
    expect(ok.success).toBe(true);
  });

  it('UserDto requires timestamps', () => {
    const ok = UserDto.safeParse({
      id: UUID,
      login: 'admin',
      roleCode: 'admin',
      isActive: true,
      mustChangePassword: false,
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(ok.success).toBe(true);
  });
});

describe('person/company/contract', () => {
  const PERSON = {
    id: UUID,
    userId: null,
    displayName: 'Влад',
    roleCode: 'emp',
    age: 800,
    isOpen: true,
    closedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
  };

  it('parses PersonDto', () => {
    expect(PersonDto.safeParse(PERSON).success).toBe(true);
  });

  it('AdminPersonDto требует расу, PersonDto её не отдаёт', () => {
    expect(AdminPersonDto.safeParse(PERSON).success).toBe(false);
    expect(AdminPersonDto.safeParse({ ...PERSON, raceCode: 'vamp' }).success).toBe(true);
    const parsed = PersonDto.parse({ ...PERSON, raceCode: 'vamp' });
    expect(parsed).not.toHaveProperty('raceCode');
  });

  it('parses CompanyDto and ContractDto', () => {
    expect(
      CompanyDto.safeParse({
        id: UUID,
        name: 'Studio',
        branchCode: 'cinema',
        headPersonId: null,
        createdAt: NOW,
        updatedAt: NOW,
      }).success,
    ).toBe(true);
    expect(
      ContractDto.safeParse({
        id: UUID,
        kind: 'permanent',
        personId: UUID,
        companyId: UUID,
        statusCode: 'sent',
        startedAt: null,
        endedAt: null,
        breakupInitiatedBy: null,
        createdAt: NOW,
        updatedAt: NOW,
      }).success,
    ).toBe(true);
  });
});

describe('rating', () => {
  it('TransferRatingInput rejects non-positive amount', () => {
    expect(TransferRatingInput.safeParse({ recipientPersonId: UUID, amount: 5 }).success).toBe(
      true,
    );
    expect(TransferRatingInput.safeParse({ recipientPersonId: UUID, amount: 0 }).success).toBe(
      false,
    );
  });

  it('parses rating DTOs', () => {
    const personRating = {
      personId: UUID,
      generated: 0,
      nowPermanent: 100,
      lastPermanent: 100,
      base: 50,
      systemTopup: 50,
      manualTopup: 0,
      oscar: 0,
      penalties: 0,
      isStar: false,
      updatedAt: NOW,
    };

    expect(PersonRatingDto.safeParse(personRating).success).toBe(true);
    // Модификатор есть только в админской DTO.
    expect(PersonRatingAdminDto.safeParse(personRating).success).toBe(false);
    expect(PersonRatingAdminDto.safeParse({ ...personRating, randomizer: -20 }).success).toBe(true);

    expect(
      RatingTransactionDto.safeParse({
        id: UUID,
        donorPersonId: UUID,
        donorCompanyId: null,
        recipientPersonId: UUID,
        recipientCompanyId: null,
        amount: 5,
        kind: 'variable_to_permanent',
        comment: null,
        authorUserId: null,
        createdAt: NOW,
      }).success,
    ).toBe(true);
  });
});

describe('contract state machine', () => {
  it('canTransition allows defined edges and rejects others', () => {
    expect(canTransition('draft', 'sent')).toBe(true);
    expect(canTransition('sent', 'confirmed')).toBe(true);
    expect(canTransition('sent', 'rejected')).toBe(true);
    expect(canTransition('confirmed', 'breakup_sent')).toBe(true);
    expect(canTransition('confirmed', 'broken_company')).toBe(true);
    expect(canTransition('confirmed', 'broken_person')).toBe(true);
    expect(canTransition('breakup_sent', 'breakup_confirmed')).toBe(true);
    expect(canTransition('breakup_sent', 'breakup_rejected')).toBe(true);

    expect(canTransition('draft', 'confirmed')).toBe(false);
    expect(canTransition('rejected', 'sent')).toBe(false);
    expect(canTransition('breakup_confirmed', 'confirmed')).toBe(false);
  });

  it('ACTIVE_CONTRACT_STATUSES does not contain terminal statuses', () => {
    expect(ACTIVE_CONTRACT_STATUSES).not.toContain('rejected');
    expect(ACTIVE_CONTRACT_STATUSES).not.toContain('broken_company');
    expect(ACTIVE_CONTRACT_STATUSES).not.toContain('breakup_confirmed');
  });

  it('CONTRACT_TRANSITIONS terminal nodes are empty', () => {
    expect(CONTRACT_TRANSITIONS.rejected).toEqual([]);
    expect(CONTRACT_TRANSITIONS.broken_company).toEqual([]);
    expect(CONTRACT_TRANSITIONS.broken_person).toEqual([]);
    expect(CONTRACT_TRANSITIONS.breakup_confirmed).toEqual([]);
  });

  it('ContractActionInput is strict and validates comment length', () => {
    expect(ContractActionInput.safeParse({}).success).toBe(true);
    expect(ContractActionInput.safeParse({ comment: 'ok' }).success).toBe(true);
    expect(ContractActionInput.safeParse({ comment: 'x', extra: 1 }).success).toBe(false);
    expect(ContractActionInput.safeParse({ comment: 'x'.repeat(1001) }).success).toBe(false);
  });

  it('ContractErrorCode enumerates domain codes', () => {
    expect(ContractErrorCode.parse('invalid_transition')).toBe('invalid_transition');
    expect(ContractErrorCode.safeParse('boom').success).toBe(false);
  });

  it('computeBreakupPenalty takes 50% from a star and 25% from a regular person', () => {
    expect(computeBreakupPenalty(200, false)).toBe(50);
    expect(computeBreakupPenalty(200, true)).toBe(100);
    // Округление до целого рейтинга.
    expect(computeBreakupPenalty(101, false)).toBe(25);
    expect(computeBreakupPenalty(0, true)).toBe(0);
    expect(computeBreakupPenalty(-40, true)).toBe(0);
  });

  it('computeNominationCost растёт по шкале 0/100/100/200/300', () => {
    expect([0, 1, 2, 3, 4, 10].map(computeNominationCost)).toEqual([0, 100, 100, 200, 300, 300]);
  });

  it('exports CAPITALIZATION_PER_EMPLOYEE_CAP constant', () => {
    expect(typeof CAPITALIZATION_PER_EMPLOYEE_CAP).toBe('number');
    expect(CAPITALIZATION_PER_EMPLOYEE_CAP).toBeGreaterThan(0);
  });

  it('CompanyRatingDto carries now/last permanent', () => {
    const parsed = CompanyRatingDto.safeParse({
      companyId: UUID,
      budget: 10,
      nowPermanent: 240,
      lastPermanent: 100,
      employeePermanent: 200,
      manualTopup: 0,
      oscar: 20,
      penalties: 20,
      updatedAt: NOW,
    });
    expect(parsed.success).toBe(true);
  });

  it('parses ContractStatusHistoryDto and query', () => {
    expect(
      ContractStatusHistoryDto.safeParse({
        id: UUID,
        contractId: UUID,
        contractKind: 'permanent',
        fromStatusCode: 'sent',
        toStatusCode: 'confirmed',
        changedAt: NOW,
        changedByUserId: UUID,
        comment: null,
        companyId: UUID,
        companyName: 'Studio',
        personId: UUID,
        personDisplayName: 'Влад',
      }).success,
    ).toBe(true);

    expect(ContractsHistoryQuery.safeParse({}).success).toBe(true);
    expect(ContractsHistoryQuery.safeParse({ limit: 10 }).success).toBe(true);
    expect(ContractsHistoryQuery.safeParse({ limit: 1000 }).success).toBe(false);
    expect(ContractsHistoryQuery.safeParse({ extra: 1 }).success).toBe(false);
  });
});

describe('oscar / ws / api error', () => {
  it('parses OscarDto', () => {
    expect(
      OscarDto.safeParse({
        id: UUID,
        filmId: UUID,
        personId: null,
        nominationCode: 'best_film',
        isWinner: false,
        createdAt: NOW,
        updatedAt: NOW,
      }).success,
    ).toBe(true);
  });

  it('parses OscarWithdrawResultDto', () => {
    expect(OscarWithdrawResultDto.safeParse({ id: UUID, refunded: 100 }).success).toBe(true);
    expect(OscarWithdrawResultDto.safeParse({ id: UUID, refunded: 1.5 }).success).toBe(false);
  });

  it('parses WsEventEnvelope', () => {
    expect(
      WsEventEnvelope.safeParse({
        channel: 'ratings:all',
        type: 'rating.updated',
        payload: { foo: 1 },
        ts: NOW,
      }).success,
    ).toBe(true);
  });

  it('parses ApiError', () => {
    expect(ApiError.safeParse({ code: 'not_found', message: 'gone' }).success).toBe(true);
    expect(ApiError.safeParse({ code: 'unknown', message: 'x' }).success).toBe(false);
  });
});

describe('scan schemas', () => {
  it('exposes constants and enums', () => {
    expect(SCAN_MAX_PAGES).toBe(4);
    expect(SCAN_ALLOWED_MIME).toContain('image/jpeg');
    expect(SCAN_ALLOWED_MIME).toContain('application/pdf');
    expect(ScanErrorCode.parse('too_many_pages')).toBe('too_many_pages');
    expect(ScanErrorCode.safeParse('boom').success).toBe(false);
  });

  it('validates CreateScanSetInput', () => {
    expect(
      CreateScanSetInput.safeParse({
        companyId: UUID,
        caption: 'Договор',
      }).success,
    ).toBe(true);
    expect(
      CreateScanSetInput.safeParse({
        companyId: UUID,
        caption: 'Договор',
        contract: { kind: 'permanent', id: UUID },
      }).success,
    ).toBe(true);
    expect(
      CreateScanSetInput.safeParse({
        companyId: UUID,
        caption: '   ',
      }).success,
    ).toBe(false);
  });

  it('parses ScanSetDto with pages', () => {
    expect(
      ScanSetDto.safeParse({
        id: UUID,
        companyId: UUID,
        caption: 'Договор',
        createdByUserId: UUID,
        createdAt: NOW,
        pages: [
          {
            id: UUID,
            setId: UUID,
            orderIdx: 0,
            mimeType: 'application/pdf',
            sizeBytes: 1234,
            uploadedAt: NOW,
          },
        ],
        contract: { kind: 'permanent', id: UUID },
      }).success,
    ).toBe(true);
  });
});

describe('jobs schemas', () => {
  const baseDef = {
    id: UUID,
    key: 'generate_variable',
    name: 'Generate variable rating',
    description: null,
    cronExpr: '5 0,6,12,18 * * *',
    timezone: 'Asia/Yekaterinburg',
    enabled: true,
    params: { withPermanent: 5, default: 1 },
    createdAt: NOW,
    updatedAt: NOW,
  };

  it('JobKey accepts only registered handlers', () => {
    expect(JobKey.safeParse('generate_variable').success).toBe(true);
    expect(JobKey.safeParse('non_existent').success).toBe(false);
  });

  it('JobStatus accepts only allowed states', () => {
    expect(JobStatus.safeParse('skipped_idempotent').success).toBe(true);
    expect(JobStatus.safeParse('done').success).toBe(false);
  });

  it('JobDefinitionDto validates baseline payload', () => {
    expect(JobDefinitionDto.safeParse(baseDef).success).toBe(true);
    expect(JobDefinitionDto.safeParse({ ...baseDef, cronExpr: 'bad;rm' }).success).toBe(false);
    expect(JobDefinitionDto.safeParse({ ...baseDef, timezone: 'a b c' }).success).toBe(false);
  });

  it('UpdateJobInput requires at least one field', () => {
    expect(UpdateJobInput.safeParse({ enabled: false }).success).toBe(true);
    expect(UpdateJobInput.safeParse({ params: { x: 1 } }).success).toBe(true);
    expect(UpdateJobInput.safeParse({}).success).toBe(false);
    expect(UpdateJobInput.safeParse({ extra: 1 }).success).toBe(false);
  });

  it('JobRunDto allows null finishedAt and output', () => {
    expect(
      JobRunDto.safeParse({
        id: UUID,
        jobKey: 'generate_variable',
        slot: '2026-04-30T12:00:00Z',
        status: 'success',
        triggeredBy: 'cron',
        startedAt: NOW,
        finishedAt: NOW,
        durationMs: 120,
        error: null,
        output: { affected: 42 },
      }).success,
    ).toBe(true);
    expect(
      JobRunDto.safeParse({
        id: UUID,
        jobKey: 'generate_variable',
        slot: '2026-04-30T12:00:00Z',
        status: 'running',
        triggeredBy: 'manual:user-1',
        startedAt: NOW,
        finishedAt: null,
        durationMs: null,
        error: null,
        output: null,
      }).success,
    ).toBe(true);
  });
});
