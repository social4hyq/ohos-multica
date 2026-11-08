import test from 'node:test';
import assert from 'node:assert/strict';
import {add} from './add.mjs';
test('positive numbers',()=>assert.equal(add(2,3),5));
test('negative numbers',()=>assert.equal(add(-2,-3),-5));
test('zero',()=>assert.equal(add(0,0),0));
