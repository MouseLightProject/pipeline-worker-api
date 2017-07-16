export interface IConfiguration<T> {
    development: T;
    test: T;
    staging: T;
    production: T;
}