// Development test fixture only; not a production build entry point.
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PropertyAccountPanel } from '../../components/ClerkPropertyAccess';
import { accountRequest, type AccountStatus } from '../../services/propertyAccountService';
function Harness() {
    const [account, setAccount] = useState<AccountStatus | null>(null);
    const refresh = async () => setAccount(await accountRequest('status'));
    useEffect(() => { void refresh(); }, []);
    return account ? <PropertyAccountPanel account={account} refresh={refresh} /> : <p>Loading</p>;
}
createRoot(document.getElementById('root')!).render(<Harness />);
