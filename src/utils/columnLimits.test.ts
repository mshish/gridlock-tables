import { describe, it, expect } from 'vitest';
import { columnLimitVars, COLUMN_LIMIT_RANGE } from './columnLimits';

describe('columnLimitVars', () => {
	it('emits both limits in ch', () => {
		expect(columnLimitVars(6, 60)).toEqual({
			'--gridlock-col-min': '6ch',
			'--gridlock-col-max': '60ch',
		});
	});

	it('never lets max fall below min', () => {
		expect(columnLimitVars(40, 20)).toEqual({
			'--gridlock-col-min': '40ch',
			'--gridlock-col-max': '40ch',
		});
	});

	it('clamps out-of-range values to the slider range', () => {
		expect(columnLimitVars(1, 500)).toEqual({
			'--gridlock-col-min': `${COLUMN_LIMIT_RANGE.min}ch`,
			'--gridlock-col-max': `${COLUMN_LIMIT_RANGE.max}ch`,
		});
	});

	it('falls back to the defaults for non-numeric values', () => {
		expect(columnLimitVars(Number.NaN, Number.NaN)).toEqual({
			'--gridlock-col-min': '6ch',
			'--gridlock-col-max': '60ch',
		});
	});
});
