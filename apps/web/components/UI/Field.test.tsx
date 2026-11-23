import { screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { renderWithIntl } from '@/test/render-with-intl'
import { FieldRoot, FieldLabel, FieldDescription, FieldError } from './Field'
import { Input } from './Input'

it('associates its label, description and error with the input and accepts function classes', () => {
  renderWithIntl(
    <FieldRoot invalid className={() => 'root-class'}>
      <FieldLabel className={() => 'label-class'}>Email</FieldLabel>
      <Input />
      <FieldDescription className={() => 'description-class'}>
        Use your login email
      </FieldDescription>
      <FieldError match className={() => 'error-class'}>
        Invalid email
      </FieldError>
    </FieldRoot>
  )
  const input = screen.getByLabelText('Email')
  expect(input).toHaveAccessibleDescription(/Use your login email/)
  expect(screen.getByText('Invalid email')).toHaveClass('error-class')
  expect(screen.getByText('Email')).toHaveClass('label-class')
})
