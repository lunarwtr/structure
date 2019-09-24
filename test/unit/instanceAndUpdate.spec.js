const { expect } = require('chai');
const { attributes } = require('../../src');

describe('instantiating a structure', () => {
  let User;

  beforeEach(() => {
    User = attributes({
      name: {
        type: String,
        default: 'Name',
      },
      password: {
        type: String,
        required: true,
      },
      nickname: {
        type: String,
        default: (instance) => instance.name,
      },
      uuid: {
        type: String,
        default: (instance) => instance.getUuid(),
      },
      attrUsingMethodUsingAttr: {
        type: String,
        default: (instance) => instance.someMethod(),
      },
    })(
      class User {
        constructor() {
          this.userInstanceStuff = 'Stuff value';
        }

        userMethod() {
          return 'I am a user';
        }

        getUuid() {
          return 10;
        }

        someMethod() {
          return `Method => ${this.name}`;
        }
      }
    );
  });

  it('has access to instance methods', () => {
    const user = new User();

    expect(user.userMethod()).to.equal('I am a user');
  });

  it('has access to instance attributes created on constructor', () => {
    const user = new User();

    expect(user.userInstanceStuff).to.equal('Stuff value');
  });

  it('has attributes passed to constructor assigned to the object', () => {
    const user = new User({
      password: 'My password',
    });

    expect(user.password).to.equal('My password');
  });

  it('does not mutate the attributes object passed to the constructor', () => {
    const attributesObject = {};

    new User(attributesObject);

    expect(attributesObject).to.be.empty;
  });

  it('ignores invalid attributes passed to constructor', () => {
    const user = new User({
      invalid: 'I will be ignored',
    });

    expect(user.invalid).to.be.undefined;
  });

  it('reflects instance attributes to #attributes', () => {
    const user = new User({
      password: 'The password',
    });

    expect(user.password).to.equal('The password');
    expect(user.attributes.password).to.equal('The password');
  });

  describe('attributes initialization', () => {
    describe('default value', () => {
      context('when attribute default value is a static value', () => {
        it('defaults to the static value', () => {
          const user = new User();

          expect(user.name).to.equal('Name');
        });
      });

      context('when attribute default value is a function', () => {
        it('calls the function using the instance of the object as parameter and perform coercion', () => {
          const user = new User();

          expect(user.uuid).to.equal('10');
        });
      });

      context('when attribute dynamic default uses a static defaultable attribute', () => {
        context('when static defaultable attribute uses default value', () => {
          it('allows to access the value of that attribute', () => {
            const user = new User();

            expect(user.nickname).to.equal('Name');
          });
        });

        context('when static defaultable attribute has a value passed to it', () => {
          it('allows to access the value of that attribute', () => {
            const user = new User({ name: 'This is my name' });

            expect(user.nickname).to.equal('This is my name');
          });
        });

        context('when dynamic default uses a method that uses an attribute with default', () => {
          it('generates the default value properly', () => {
            const user = new User();

            expect(user.attrUsingMethodUsingAttr).to.equal('Method => Name');
          });
        });
      });

      it('overwrites default value with passed value', () => {
        const user = new User({ name: 'Not the default' });

        expect(user.name).to.equal('Not the default');
      });
    });

    describe('instantiating a structure with buildStrict', () => {
      context('when object is invalid', () => {
        context('when using default error class', () => {
          it('throws a default error', () => {
            let errorDetails = [
              {
                message: '"password" is required',
                path: 'password',
              },
            ];

            expect(() => {
              User.buildStrict();
            })
              .to.throw(Error, 'Invalid Attributes')
              .with.property('details')
              .that.deep.equals(errorDetails);
          });
        });

        context('when using custom error class', () => {
          let UserWithCustomError;
          let InvalidUser;

          beforeEach(() => {
            InvalidUser = class InvalidUser extends Error {
              constructor(errors) {
                super('There is something wrong with this user');
                this.errors = errors;
              }
            };

            UserWithCustomError = attributes(
              {
                name: {
                  type: String,
                  minLength: 3,
                },
              },
              {
                strictValidationErrorClass: InvalidUser,
              }
            )(class UserWithCustomError {});
          });

          it('throws a custom error', () => {
            expect(() => {
              UserWithCustomError.buildStrict({
                name: 'JJ',
              });
            }).to.throw(InvalidUser, 'There is something wrong with this user');
          });
        });
      });

      context('when object is valid', () => {
        it('return an intance', () => {
          const user = User.buildStrict({
            password: 'My password',
          });

          expect(user.password).to.equal('My password');
        });
      });
    });
  });
});

describe('instantiating a structure with dynamic attribute types', () => {
  let CircularUser;
  let CircularBook;

  beforeEach(() => {
    CircularUser = require('../fixtures/CircularUser');
    CircularBook = require('../fixtures/CircularBook');
  });

  it('creates instance properly', () => {
    const userOne = new CircularUser({
      name: 'Circular user one',
      friends: [],
      favoriteBook: new CircularBook({
        name: 'Brave new world',
        owner: new CircularUser(),
      }),
    });

    const userTwo = new CircularUser({
      name: 'Circular user two',
      friends: [userOne],
    });

    expect(userOne).to.be.instanceOf(CircularUser);
    expect(userOne.favoriteBook).to.be.instanceOf(CircularBook);
    expect(userOne.favoriteBook.owner).to.be.instanceOf(CircularUser);
    expect(userTwo).to.be.instanceOf(CircularUser);
    expect(userTwo.friends[0]).to.be.instanceOf(CircularUser);
  });

  describe('with buildStrict', () => {
    context('when object is invalid', () => {
      it('throw an error', () => {
        let errorDetails = [
          {
            message: '"pages" must be a number',
            path: 'favoriteBook.pages',
          },
        ];

        expect(() => {
          CircularUser.buildStrict({
            name: 'Circular user one',
            friends: [],
            favoriteBook: new CircularBook({
              name: 'Brave new world',
              pages: 'twenty',
            }),
          });
        })
          .to.throw(Error, 'Invalid Attributes')
          .with.property('details')
          .that.deep.equals(errorDetails);
      });
    });
  });
});

describe('updating an instance', () => {
  let User;

  beforeEach(() => {
    User = attributes({
      name: String,
    })(class User {});
  });

  it('updates instance attribute value when assigned a new value', () => {
    const user = new User({
      name: 'My name',
    });

    user.name = 'New name';

    expect(user.name).to.equal('New name');
  });

  it('reflects new value assigned to attribute on #attributes', () => {
    const user = new User({
      name: 'My name',
    });

    user.name = 'New name';

    expect(user.attributes.name).to.equal('New name');
  });

  it('reflects new value assigned to #attributes on instance attribute', () => {
    const user = new User({
      name: 'My name',
    });

    user.attributes = {
      name: 'New name',
    };

    expect(user.name).to.equal('New name');
  });

  it('does not throw if no attributes are passed when instantiating', () => {
    expect(() => {
      new User();
    }).to.not.throw(Error);
  });

  it('throws if value assigned to #attributes is not an object', () => {
    const user = new User({
      name: 'My name',
    });

    expect(() => {
      user.attributes = null;
    }).to.throw(TypeError, /^#attributes can't be set to a non-object\.$/);
  });
});

describe('updating a structure with dynamic attribute types', () => {
  let CircularUser;
  let CircularBook;

  beforeEach(() => {
    CircularUser = require('../fixtures/CircularUser');
    CircularBook = require('../fixtures/CircularBook');
  });

  it('updates instance attribute when assigned a new value', () => {
    const user = new CircularUser({
      favoriteBook: new CircularBook({
        name: 'Brave new world',
        owner: new CircularUser(),
      }),
    });

    user.favoriteBook = new CircularBook({
      name: '1984',
      owner: user,
    });

    expect(user.favoriteBook).to.be.instanceOf(CircularBook);
    expect(user.favoriteBook.owner).to.be.instanceOf(CircularUser);
    expect(user.favoriteBook.owner).to.equal(user);
  });
});

describe('cloning an instance', () => {
  let User;
  let Book;

  beforeEach(() => {
    Book = attributes({
      name: {
        type: String,
        required: true,
      },
    })(class Book {});

    User = attributes({
      name: {
        type: String,
        required: true,
      },
      age: Number,
      favoriteBook: Book,
    })(class User {});
  });

  context('when nothing is overwritten', () => {
    context('when not passing overwrite object', () => {
      it('makes a shallow clone', () => {
        const user = new User({
          name: 'Me',
          favoriteBook: {
            name: 'The Silmarillion',
          },
        });

        const userClone = user.clone();

        expect(userClone.name).to.equal('Me');
        expect(userClone.favoriteBook).to.equal(user.favoriteBook);
      });
    });

    context('when passing overwrite object', () => {
      it('makes a shallow clone', () => {
        const user = new User({
          name: 'Me',
          favoriteBook: {
            name: 'The Silmarillion',
          },
        });

        const userClone = user.clone({});

        expect(userClone.name).to.equal('Me');
        expect(userClone.favoriteBook).to.equal(user.favoriteBook);
      });
    });
  });

  context('when overwritting attributes', () => {
    context('when overwritting a primitive type attribute', () => {
      it('overwrites it, leaving other attributes untouched', () => {
        const user = new User({
          name: 'Me',
          favoriteBook: {
            name: 'The Silmarillion',
          },
        });

        const userClone = user.clone({
          name: 'Myself',
        });

        expect(userClone.name).to.equal('Myself');
        expect(userClone.favoriteBook).to.equal(user.favoriteBook);
      });

      context('when overwritten attribute needs coercion', () => {
        it('coerces attribute', () => {
          const user = new User({
            name: 'Me',
            age: 42,
            favoriteBook: {
              name: 'The Silmarillion',
            },
          });

          const userClone = user.clone({
            age: '123',
          });

          expect(userClone.age).to.equal(123);
        });
      });
    });

    context('when overwritting a nested structure', () => {
      context('when passing a new instance of the nested structure', () => {
        it('overwrites it, leaving other attributes untouched', () => {
          const user = new User({
            name: 'Me',
            favoriteBook: {
              name: 'The Silmarillion',
            },
          });

          const userClone = user.clone({
            favoriteBook: new Book({ name: 'The Lord of the Rings' }),
          });

          expect(userClone.name).to.equal('Me');
          expect(userClone.favoriteBook).not.to.equal(user.favoriteBook);
          expect(userClone.favoriteBook.name).to.equal('The Lord of the Rings');
        });
      });

      context('when passing the attributes of the nested structure', () => {
        it('coerces attribute to a new nested structure, overwrites it, and leave other attributes untouched', () => {
          const user = new User({
            name: 'Me',
            favoriteBook: {
              name: 'The Silmarillion',
            },
          });

          const userClone = user.clone({
            favoriteBook: { name: 'The Lord of the Rings' },
          });

          expect(userClone.name).to.equal('Me');
          expect(userClone.favoriteBook).not.to.equal(user.favoriteBook);
          expect(userClone.favoriteBook.name).to.equal('The Lord of the Rings');
        });
      });
    });
  });

  context('strict mode', () => {
    context('when overwritten attributes are valid', () => {
      it('clones normally', () => {
        const user = new User({
          name: 'Me',
          favoriteBook: {
            name: 'The Silmarillion',
          },
        });

        const userClone = user.clone({ name: 'Me' }, { strict: true });

        expect(userClone.name).to.equal('Me');
        expect(userClone.favoriteBook).to.equal(user.favoriteBook);
      });
    });

    context('when overwritten attributes are invalid', () => {
      context('when primitive attribute is invalid', () => {
        it('throws an error', () => {
          const user = new User({
            name: 'Me',
            favoriteBook: {
              name: 'The Silmarillion',
            },
          });

          let errorDetails = [
            {
              message: '"name" is required',
              path: 'name',
            },
          ];

          expect(() => {
            user.clone({ name: null }, { strict: true });
          })
            .to.throw(Error, 'Invalid Attributes')
            .with.property('details')
            .that.deep.equals(errorDetails);
        });
      });

      context('when nested attribute is invalid', () => {
        context('when passing a the attributes of the nested attribute', () => {
          it('throws an error', () => {
            const user = new User({
              name: 'Me',
              favoriteBook: {
                name: 'The Silmarillion',
              },
            });

            let errorDetails = [
              {
                message: '"name" is required',
                path: 'favoriteBook.name',
              },
            ];

            expect(() => {
              user.clone({ favoriteBook: {} }, { strict: true });
            })
              .to.throw(Error, 'Invalid Attributes')
              .with.property('details')
              .that.deep.equals(errorDetails);
          });
        });
      });
    });
  });
});
