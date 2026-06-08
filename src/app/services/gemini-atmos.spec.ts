import { TestBed } from '@angular/core/testing';

import { GeminiAtmos } from './gemini-atmos';

describe('GeminiAtmos', () => {
  let service: GeminiAtmos;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GeminiAtmos);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
