import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  Output,
  forwardRef
} from '@angular/core';
import {
  ControlValueAccessor,
  FormControl,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule
} from '@angular/forms';

@Component({
  selector: 'app-input-field',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="relative">
      <input
        [type]="type"
        [id]="id"
        [name]="name"
        [placeholder]="placeholder"
        [value]="value"
        [disabled]="disabled"
        [ngClass]="inputClasses"
        (input)="onInput($event)"
        (blur)="onTouched()"
      />

      @if (hint) {
        <p class="mt-1.5 text-xs"
          [ngClass]="{
            'text-error-500': error,
            'text-success-500': success,
            'text-gray-500': !error && !success
          }">
          {{ hint }}
        </p>
      }
    </div>
  `,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputFieldComponent),
      multi: true,
    },
  ],
})
export class InputFieldComponent implements ControlValueAccessor {

   @Input() type: string = 'text';
  @Input() id?: string = '';
  @Input() name?: string = '';
  @Input() placeholder?: string = '';
  @Input() value: string | number = '';
  @Input() min?: string;
  @Input() max?: string;
  @Input() step?: number;
  @Input() disabled: boolean = false;
  @Input() success: boolean = false;
  @Input() error: boolean = false;
  @Input() hint?: string;
  @Input() className: string = '';
  control = new FormControl();
  @Output() valueChange = new EventEmitter<string | number>();

  // Internal callbacks
  onChange: (value: any) => void = () => {};
  onTouched: () => void = () => {};

  // --- ControlValueAccessor methods ---
  writeValue(value: any): void {
    this.value = value ?? '';
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  onInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const newValue = this.type === 'number' ? +input.value : input.value;
    this.value = newValue;
    this.onChange(newValue);
  }

  get inputClasses(): string {
    let inputClasses = `h-11 w-full rounded-lg border appearance-none px-4 py-2.5 text-sm shadow-theme-xs placeholder:text-gray-400 focus:outline-hidden focus:ring-3 ${this.className}`;
    if (this.disabled) {
      inputClasses += ' opacity-40 cursor-not-allowed';
    }
    return inputClasses;
  }
}
