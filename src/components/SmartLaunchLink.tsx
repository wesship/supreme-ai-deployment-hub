import React from 'react';
import { Link, LinkProps } from 'react-router-dom';
import { useAuthState } from '@/hooks/useAuthState';

type Props = Omit<LinkProps, 'to'> & {
  authedTo?: string;
  anonTo?: string;
  children: React.ReactNode;
};

/**
 * Auth-aware Link. Routes signed-in users into the app, signed-out users to login
 * with a redirect back to the intended destination.
 */
export const SmartLaunchLink: React.FC<Props> = ({
  authedTo = '/app',
  anonTo = '/login',
  children,
  ...rest
}) => {
  const authed = useAuthState();
  const to =
    authed !== true
      ? `${anonTo}?redirect=${encodeURIComponent(authedTo)}`
      : authedTo;
  return (
    <Link to={to} {...rest}>
      {children}
    </Link>
  );
};

export default SmartLaunchLink;
