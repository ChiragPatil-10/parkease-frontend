import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { DriverMyVehicles } from './driver-my-vehicles';

@Component({ template: 'lots stub' })
class LotsStub {}

describe('DriverMyVehicles', () => {
  let root: HTMLElement;

  const query = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector);
  const queryAll = (selector: string) => Array.from(root.querySelectorAll<HTMLElement>(selector));
  const button = (text: string) =>
    queryAll('button').find((b) => b.textContent?.trim() === text) as HTMLButtonElement;

  let harness: RouterTestingHarness;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'vehicles', component: DriverMyVehicles },
          { path: 'lots', component: LotsStub },
        ]),
      ],
    }).compileComponents();

    harness = await RouterTestingHarness.create('/vehicles');
    root = harness.routeNativeElement as HTMLElement;
  });

  const click = async (el: HTMLElement) => {
    el.click();
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();
  };

  it('renders the two mock vehicles with only a Delete button each', () => {
    const cards = queryAll('main li');
    expect(cards.length).toBe(2);
    expect(cards[0].textContent).toContain('KA 05 MJ 4471');
    expect(cards[0].textContent).toContain('Honda City');
    expect(cards[0].textContent).toContain('Four Wheeler');
    expect(cards[1].textContent).toContain('Ather 450X');
    expect(cards[1].textContent).toContain('Two Wheeler · Electric');
    expect(cards.every((c) => c.querySelectorAll('button').length === 1)).toBe(true);
    expect(root.textContent).not.toContain('Edit');
  });

  it('highlights My Vehicles in the nav', () => {
    const active = queryAll('nav .font-semibold');
    expect(active.length).toBe(1);
    expect(active[0].textContent?.trim()).toBe('My Vehicles');
  });

  it('navigates to /lots from the Search Lots nav link', async () => {
    const link = queryAll('nav a').find((a) => a.textContent?.trim() === 'Search Lots')!;
    await click(link);
    expect(TestBed.inject(Router).url).toBe('/lots');
  });

  describe('add vehicle modal', () => {
    beforeEach(async () => {
      await click(button('+ Add vehicle'));
    });

    it('opens as a labelled modal dialog and focuses the plate field', () => {
      const dialog = query('[role="dialog"]')!;
      expect(dialog.getAttribute('aria-modal')).toBe('true');
      expect(root.querySelector(`#${dialog.getAttribute('aria-labelledby')}`)?.textContent).toContain(
        'Add a vehicle',
      );
      expect(document.activeElement?.id).toBe('plate');
      expect(document.body.style.overflow).toBe('hidden');
    });

    it('closes on Cancel, close button, Escape and backdrop click, restoring scroll', async () => {
      const closers: Array<() => void> = [
        () => button('Cancel').click(),
        () => query('[aria-label="Close"]')!.click(),
        () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })),
        () => query('[role="dialog"]')!.parentElement!.click(),
      ];
      for (const close of closers) {
        expect(query('[role="dialog"]')).not.toBeNull();
        close();
        harness.detectChanges();
        expect(query('[role="dialog"]')).toBeNull();
        expect(document.body.style.overflow).toBe('');
        await click(button('+ Add vehicle'));
      }
    });

    it('starts with no vehicle type selected and moves the choice with arrow keys', () => {
      const radios = queryAll('[role="radio"]');
      expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual(['false', 'false', 'false']);

      radios[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      harness.detectChanges();
      expect(queryAll('[role="radio"]').map((r) => r.getAttribute('aria-checked'))).toEqual([
        'false',
        'true',
        'false',
      ]);
      expect(document.activeElement).toBe(radios[1]);

      radios[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
      radios[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
      harness.detectChanges();
      expect(radios[2].getAttribute('aria-checked')).toBe('true');
    });

    it('toggles Electric, and disables it with a note while Heavy is selected', () => {
      const toggle = query<HTMLButtonElement>('[role="switch"]')!;
      expect(toggle.getAttribute('aria-checked')).toBe('false');
      expect(toggle.disabled).toBe(false);

      toggle.click();
      harness.detectChanges();
      expect(toggle.getAttribute('aria-checked')).toBe('true');

      button('Heavy').click();
      harness.detectChanges();
      expect(toggle.getAttribute('aria-checked')).toBe('false');
      expect(toggle.disabled).toBe(true);
      expect(root.textContent).toContain("Heavy vehicles can't be electric");
    });

    it('traps Tab focus inside the dialog', () => {
      const dialog = query('[role="dialog"]')!;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>('button:not([disabled]), input'),
      ).filter((el) => el.getAttribute('tabindex') !== '-1');
      const last = focusable[focusable.length - 1];
      last.focus();
      const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
      last.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(focusable[0]);
    });
  });

  describe('delete dialog', () => {
    let opener: HTMLButtonElement;

    beforeEach(async () => {
      opener = queryAll('main li button')[0] as HTMLButtonElement;
      opener.focus();
      await click(opener);
    });

    it('opens as an alertdialog with the clicked vehicle and no warning', () => {
      const dialog = query('[role="alertdialog"]')!;
      expect(dialog.getAttribute('aria-modal')).toBe('true');
      expect(dialog.textContent).toContain('Delete this vehicle?');
      expect(dialog.textContent).toContain('KA 05 MJ 4471');
      expect(dialog.textContent).toContain('(Honda City)');
      expect(dialog.textContent).not.toContain('upcoming booking');
      expect(document.activeElement?.textContent?.trim()).toBe('Cancel');
    });

    it('closes on Escape and returns focus to the Delete button that opened it', () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      harness.detectChanges();
      expect(query('[role="alertdialog"]')).toBeNull();
      expect(document.activeElement).toBe(opener);
    });

    it('closes on backdrop click and Cancel; the red Delete button does nothing', async () => {
      const dialog = query('[role="alertdialog"]')!;
      dialog.querySelectorAll('button')[1].click();
      harness.detectChanges();
      expect(query('[role="alertdialog"]')).not.toBeNull();

      dialog.parentElement!.click();
      harness.detectChanges();
      expect(query('[role="alertdialog"]')).toBeNull();

      await click(opener);
      button('Cancel').click();
      harness.detectChanges();
      expect(query('[role="alertdialog"]')).toBeNull();
    });
  });
});
