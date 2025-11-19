import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SampleComponent from './SampleComponent';

describe('SampleComponent', () => {
  it('should render the message', () => {
    const message = 'Hello, World!';
    render(<SampleComponent message={message} />);
    expect(screen.getByText(message)).toBeInTheDocument();
  });

  it('should render a different message', () => {
    const message = 'Testing 123';
    render(<SampleComponent message={message} />);
    expect(screen.getByText(message)).toBeInTheDocument();
  });
});
