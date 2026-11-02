// Linux-only shim used for tests and CI. Apple builds use Zetetic's SQLCipher package.
#ifndef LT_CSQLCIPHER_SHIM_H
#define LT_CSQLCIPHER_SHIM_H
#define SQLITE_HAS_CODEC 1
#include <sqlcipher/sqlite3.h>
#endif
