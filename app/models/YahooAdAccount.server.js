// SPDX-License-Identifier: MIT

import db from "../db.server";

export async function getYahooAdAccount(type) {
  const yahooAdAccount = await db.yahooAdAccount.findFirst({ where: { type: type } });

  if (!yahooAdAccount) {
    return null;
  }

  return yahooAdAccount;
}

export async function getYahooAdAccounts() {
  const yahooAdAccounts = await db.yahooAdAccount.findMany();

  if (!yahooAdAccounts?.length) {
    return null;
  }

  return yahooAdAccounts;
}