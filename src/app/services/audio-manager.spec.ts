import { TestBed } from '@angular/core/testing';

import { AudioManager } from './audio-manager';

describe('AudioManager', () => {
  let service: AudioManager;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AudioManager);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
