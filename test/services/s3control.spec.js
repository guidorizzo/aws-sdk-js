var helpers = require('../helpers');
var AWS = helpers.AWS;

describe('AWS.S3Control', function() {
  it('append accountId to hostname when supplied', function() {
    var client = new AWS.S3Control({region: 'us-east-1'});
    var request = client.getPublicLockdown({AccountId: '111'});
    helpers.mockResponse({data: {}});
    request.send();
    expect(request.httpRequest.headers['x-amz-account-id']).to.eql(undefined);
    expect(request.httpRequest.headers.Host).to.eql('111.s3-control.us-east-1.amazonaws.com');
    expect(request.httpRequest.endpoint.hostname).to.eql('111.s3-control.us-east-1.amazonaws.com');
  });

  it('shouldn\'t append accountId if not supplied', function() {
    var client = new AWS.S3Control({region: 'us-east-1'});
    var request = client.putPublicLockdown({});
    helpers.mockResponse({data: {}});
    request.send();
    expect(request.httpRequest.headers.Host).to.eql('s3-control.us-east-1.amazonaws.com');
    expect(request.httpRequest.endpoint.hostname).to.eql('s3-control.us-east-1.amazonaws.com');
  });

  it('append accountId to hostname when supplied and using dualstack', function() {
    var client = new AWS.S3Control({region: 'us-east-1', useDualstack: true});
    var request = client.getPublicLockdown({AccountId: '222'});
    helpers.mockResponse({data: {}});
    request.send();
    expect(request.httpRequest.headers.Host).to.eql('222.s3-control.dualstack.us-east-1.amazonaws.com');
    expect(request.httpRequest.endpoint.hostname).to.eql('222.s3-control.dualstack.us-east-1.amazonaws.com'); 
  });

  it('append accountId to hostname when supplied and using customized endpoint', function() {
    var client = new AWS.S3Control({endpoint: 's3-control-fips.us-east-1.amazonaws.com'});
    var request = client.getPublicLockdown({AccountId: '222'});
    helpers.mockResponse({data: {}});
    request.send();
    expect(request.httpRequest.headers.Host).to.eql('222.s3-control-fips.us-east-1.amazonaws.com');
    expect(request.httpRequest.endpoint.hostname).to.eql('222.s3-control-fips.us-east-1.amazonaws.com'); 
  })

  it('should add hostId and requestId to exception response', function() {
    var client = new AWS.S3Control({region: 'us-east-1'});
    var request = client.deletePublicLockdown({AccountId: '111'});
    helpers.mockHttpResponse(404, {
      'x-amz-request-id': 'requestId123',
      'x-amz-id-2': 'hostId321',
    }, '<?xml version="1.0" encoding="UTF-8"?><ErrorResponse><Error><Code>NoSuchAccount</Code><Message>The account was not found</Message><AccountId>111</AccountId></Error><RequestId>requestId123</RequestId><HostId>hostId321</HostId></ErrorResponse>')
    request.send(function(err, data) {
      expect(data).to.eql(null);
      expect(err.extendedRequestId).to.eql('hostId321');
      expect(err.requestId).to.eql('requestId123');
      expect(err.code).to.eql('NoSuchAccount');
      expect(err.message).to.eql('The account was not found');
    });
  });

  it('should add hostId and requestId from successful response', function() {
    var client = new AWS.S3Control({region: 'us-east-1'});
    var request = client.deletePublicLockdown({AccountId: '111'});
    helpers.mockHttpResponse(200, {
      'x-amz-request-id': 'requestId123',
      'x-amz-id-2': 'hostId321',
    }, '')
    request.send(function(err, data) {
      expect(err).to.eql(null);
      expect(this.extendedRequestId).to.eql('hostId321');
      expect(this.requestId).to.eql('requestId123');
    });
  })

  it('should use the V4 signer', function() {
    var client = new AWS.S3Control();
    expect(client.getSignerClass()).to.eql(AWS.Signers.V4)
  });

  it('does not double encode path for S3Control', function() {
    var client = new AWS.S3Control();
    var req;
    req = client.putPublicLockdown({
      AccountId: '111',
      PublicLockdownConfiguration: {
        RejectPublicAcls: false
      }
    }).build();
    req.httpRequest.path = '/fake%3Apath'
    var SignerClass = client.getSignerClass(req);
    signer = new SignerClass(req.httpRequest, req.service.api.signingName || req.service.api.endpointPrefix);
    return expect(signer.canonicalString().split('\n')[1]).to.equal('/fake%3Apath');
  });

  it('validate accountId length', function() {
    var client = new AWS.S3Control({region: 'us-east-1', paramValidateion: true});

    var request = client.getPublicLockdown({AccountId: ''}).build();
    expect(request.httpRequest.endpoint.hostname).to.eql('s3-control.us-east-1.amazonaws.com')

    var stringTooLong = '1'
    for (var i = 0; i < 64; i++) stringTooLong += '1';
    request = client.getPublicLockdown({AccountId: stringTooLong});
    helpers.mockResponse({data: {}});
    request.send();
    var response = request.response;
    expect(response.error).not.to.be.undefined;
    expect(response.data).to.eql(null);
    expect(response.error.code).to.eql('ValidationError');
    expect(response.error.message).to.eql('Account Id length should bigger than 0 and smaller than 64');

  });

  it('validate accountId pattern', function() {
    var client = new AWS.S3Control({region: 'us-east-1', paramValidateion: true});
    var wrongStrings = ['a.b', '.ab', 'ab.', '-ab', 'Ab-', 'asdw*'];
    for (var i = 0; i < wrongStrings.length; i++) {
      var request = client.getPublicLockdown({AccountId: wrongStrings[i]});
      request.send();
      expect(request.response.error).not.to.be.undefined;
      expect(request.response.data).to.eql(null);
      expect(request.response.error.code).to.eql('ValidationError');
      expect(request.response.error.message).to.eql('AccountId should be hostname compatible');
    }
  })
});