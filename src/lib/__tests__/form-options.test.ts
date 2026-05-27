import { describe, it, expect } from 'vitest';
import {
    jobPositionOptions,
    raceOptions,
    nationalityOptions,
    religionOptions,
    provinceOptions,
    withOtherOption,
    getDistrictOptions,
    getSubDistrictOptions,
    otherOption,
} from '../form-options';

describe('Static Options', () => {
    it('should have job position options', () => {
        expect(jobPositionOptions).toBeInstanceOf(Array);
        expect(jobPositionOptions.length).toBeGreaterThan(0);
        expect(jobPositionOptions[0]).toHaveProperty('value');
        expect(jobPositionOptions[0]).toHaveProperty('label');
    });

    it('should have race options', () => {
        expect(raceOptions).toBeInstanceOf(Array);
        expect(raceOptions.length).toBeGreaterThan(0);
        expect(raceOptions.some(o => o.value === 'ไทย')).toBe(true);
    });

    it('should have nationality options', () => {
        expect(nationalityOptions).toBeInstanceOf(Array);
        expect(nationalityOptions.some(o => o.value === 'ไทย')).toBe(true);
    });

    it('should have religion options', () => {
        expect(religionOptions).toBeInstanceOf(Array);
        expect(religionOptions.some(o => o.value === 'พุทธ')).toBe(true);
    });

    it('should have province options', () => {
        expect(provinceOptions).toBeInstanceOf(Array);
        expect(provinceOptions.length).toBeGreaterThan(0);
        expect(provinceOptions.some(p => p.value === 'กรุงเทพมหานคร')).toBe(true);
    });
});

describe('withOtherOption', () => {
    it('should add "อื่นๆ" option at the end', () => {
        const options = [{ value: 'a', label: 'Option A' }];
        const result = withOtherOption(options);

        expect(result.length).toBe(2);
        expect(result[result.length - 1]).toEqual(otherOption);
    });

    it('should not modify original array', () => {
        const options = [{ value: 'a', label: 'Option A' }];
        const originalLength = options.length;
        withOtherOption(options);

        expect(options.length).toBe(originalLength);
    });

    it('should add custom value if not in options', () => {
        const options = [{ value: 'a', label: 'Option A' }];
        const customValue = 'custom_value';
        const result = withOtherOption(options, customValue);

        // Should have: original + custom + other
        expect(result.length).toBe(3);
        expect(result.some(o => o.value === customValue)).toBe(true);
    });

    it('should not add duplicate if custom value already exists', () => {
        const options = [{ value: 'a', label: 'Option A' }];
        const result = withOtherOption(options, 'a');

        // Should have: original + other (no duplicate 'a')
        expect(result.length).toBe(2);
    });

    it('should not add custom value if it is __other__', () => {
        const options = [{ value: 'a', label: 'Option A' }];
        const result = withOtherOption(options, '__other__');

        // Should have: original + other (no extra __other__)
        expect(result.length).toBe(2);
        expect(result.filter(o => o.value === '__other__').length).toBe(1);
    });
});

describe('getDistrictOptions', () => {
    it('should return empty array for undefined province', () => {
        const result = getDistrictOptions(undefined);
        expect(result).toEqual([]);
    });

    it('should return empty array for non-existent province', () => {
        const result = getDistrictOptions('จังหวัดที่ไม่มีอยู่จริง');
        expect(result).toEqual([]);
    });

    it('should return districts for Bangkok', () => {
        const result = getDistrictOptions('กรุงเทพมหานคร');

        expect(result).toBeInstanceOf(Array);
        expect(result.length).toBeGreaterThan(0);
        expect(result.some(d => d.value === 'บางนา')).toBe(true);
    });

    it('should return districts for Chiang Mai', () => {
        const result = getDistrictOptions('เชียงใหม่');

        expect(result).toBeInstanceOf(Array);
        expect(result.length).toBeGreaterThan(0);
        expect(result.some(d => d.value === 'เมืองเชียงใหม่')).toBe(true);
    });

    it('should work with province label as well as value', () => {
        const result = getDistrictOptions('กรุงเทพมหานคร');
        expect(result.length).toBeGreaterThan(0);
    });
});

describe('getSubDistrictOptions', () => {
    it('should return empty array for undefined province', () => {
        const result = getSubDistrictOptions(undefined, 'บางนา');
        expect(result).toEqual([]);
    });

    it('should return empty array for undefined district', () => {
        const result = getSubDistrictOptions('กรุงเทพมหานคร', undefined);
        expect(result).toEqual([]);
    });

    it('should return empty array for non-existent district', () => {
        const result = getSubDistrictOptions('กรุงเทพมหานคร', 'อำเภอที่ไม่มีอยู่จริง');
        expect(result).toEqual([]);
    });

    it('should return sub-districts for Bangkok, Bang Na', () => {
        const result = getSubDistrictOptions('กรุงเทพมหานคร', 'บางนา');

        expect(result).toBeInstanceOf(Array);
        expect(result.length).toBeGreaterThan(0);
        expect(result.some(s => s.value === 'บางนาใต้')).toBe(true);
        expect(result.some(s => s.value === 'บางนาเหนือ')).toBe(true);
    });

    it('should return sub-districts for Din Daeng', () => {
        const result = getSubDistrictOptions('กรุงเทพมหานคร', 'ดินแดง');

        expect(result).toBeInstanceOf(Array);
        expect(result.length).toBeGreaterThan(0);
        expect(result.some(s => s.value === 'ดินแดง')).toBe(true);
    });

    it('should return sub-districts for Chiang Mai, Mueang', () => {
        const result = getSubDistrictOptions('เชียงใหม่', 'เมืองเชียงใหม่');

        expect(result).toBeInstanceOf(Array);
        expect(result.length).toBeGreaterThan(0);
        expect(result.some(s => s.value === 'ศรีภูมิ')).toBe(true);
    });
});
