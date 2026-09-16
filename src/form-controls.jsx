import React from 'react';
import { Checkbox } from '@patternfly/react-core/dist/esm/components/Checkbox/index.js';
import { FormSelect, FormSelectOption } from '@patternfly/react-core/dist/esm/components/FormSelect/index.js';

export function SelectControl({ id, value, onChange, options, ariaLabel, isDisabled = false }) {
    return (
        <FormSelect
            id={id}
            value={String(value ?? '')}
            aria-label={ariaLabel}
            isDisabled={isDisabled}
            onChange={(_event, nextValue) => onChange(nextValue)}
        >
            {options.map(option => (
                <FormSelectOption
                    key={String(option.value)}
                    value={String(option.value)}
                    label={option.label}
                    isDisabled={option.disabled === true}
                />
            ))}
        </FormSelect>
    );
}

export function CheckboxControl({ id, label, isChecked, onChange, isDisabled = false, description }) {
    return (
        <Checkbox
            id={id}
            label={label}
            description={description}
            isChecked={isChecked}
            isDisabled={isDisabled}
            onChange={(_event, checked) => onChange(checked)}
        />
    );
}
