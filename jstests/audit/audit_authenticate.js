// test that authenticate gets audited

if (TestData.testData !== undefined) {
    load(TestData.testData + '/audit/_audit_helpers.js');
} else {
    load('jstests/audit/_audit_helpers.js');
}

// Creates a User with userAdmin permissions and name john
var createUserFromObj = function (m, db, obj) {
    var adminDB = m.getDB('admin');
    adminDB.auth('admin','admin');
    db.createUser( obj );
    adminDB.logout();
}

var testDBName = 'audit_authenticate';
auditTest(
    'authenticate',
    function(m) {
        createAdminUserForAudit(m);
        var testDB = m.getDB(testDBName);
        var userObj = { user: 'john', pwd: 'john', roles: [ { role:'userAdmin', db:testDBName} ] };
        createUserFromObj(m, testDB, userObj);

        assert(testDB.auth('john', 'john'), "could not auth as john (pwd john)");

        var auditColl = getAuditEventsCollection(m, undefined, true);
        assert.eq(1, auditColl.count({
            atype: 'authenticate',
            ts: withinTheLastFewSeconds(),
            'params.user': 'john',
            'params.mechanism': 'SCRAM-SHA-1',
            'params.db': testDBName,
            result: 0,
        }), "FAILED, audit log: " + tojson(auditColl.find().toArray()));

        assert( !testDB.auth('john', 'nope'), "incorrectly able to auth as john (pwd nope)");

        // ErrorCodes::AuthenticationFailed in src/mongo/base/error_codes.err
        var authenticationFailureCode = 18;

        var auditColl = getAuditEventsCollection(m, undefined, true);
        assert.eq(1, auditColl.count({
            atype: 'authenticate',
            ts: withinTheLastFewSeconds(),
            'params.user': 'john',
            'params.mechanism': 'SCRAM-SHA-1',
            'params.db': testDBName,
            result: authenticationFailureCode,
        }), "FAILED, audit log: " + tojson(auditColl.find().toArray()));
    },
    // Enable auth for this test
    { auth: "" }
);
