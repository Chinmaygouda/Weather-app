import { TestBed } from '@angular/core/testing';

import { EnvironmentTracker } from './environment-tracker';

describe('EnvironmentTracker', () => {
  let service: EnvironmentTracker;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(EnvironmentTracker);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
