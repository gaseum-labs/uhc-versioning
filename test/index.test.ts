import { Version } from '../src/index';
import { describe, expect, test } from '@jest/globals';

test('parse version v1.0.0', () => {
	expect(Version.parse('v1.0.0')).toStrictEqual(new Version(1, 0, 0));
});
