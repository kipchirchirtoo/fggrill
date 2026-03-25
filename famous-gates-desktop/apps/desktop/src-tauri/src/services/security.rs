// Secure token storage — uses OS keychain via the keyring crate

use anyhow::Result;
use keyring::Entry;

const SERVICE: &str = "com.hirall.famousgates";

pub fn store_token(key: &str, value: &str) -> Result<()> {
    let entry = Entry::new(SERVICE, key)?;
    entry.set_password(value)?;
    Ok(())
}

pub fn get_token(key: &str) -> Result<Option<String>> {
    let entry = Entry::new(SERVICE, key)?;
    match entry.get_password() {
        Ok(val) => Ok(Some(val)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.into()),
    }
}

pub fn delete_token(key: &str) -> Result<()> {
    let entry = Entry::new(SERVICE, key)?;
    match entry.delete_password() {
        Ok(_) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(anyhow::anyhow!(e)),
    }
}
