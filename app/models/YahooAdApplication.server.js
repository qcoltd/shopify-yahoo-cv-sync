// SPDX-License-Identifier: MIT

import db from "../db.server";

export async function getYahooAdApplication() {
  const yahooAdApplication = await db.yahooAdApplication.findFirst();

  if (!yahooAdApplication) {
    return null;
  }

  return yahooAdApplication;
}